import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, mofsTable, itemsTable, pickRecordsTable } from '../db/schema';
import { type ScanItemInput } from '../schema';
import { scanItem } from '../handlers/scan_item';
import { eq, and } from 'drizzle-orm';

describe('scanItem', () => {
  let testUser: any;
  let testMof: any;
  let testItem: any;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        username: 'picker_user',
        email: 'picker@test.com',
        full_name: 'Picker User',
        role: 'Picking'
      })
      .returning()
      .execute();
    testUser = users[0];

    // Create test MOF
    const mofs = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-001',
        part_number: 'PART-001',
        quantity_requested: 2,
        expected_receiving_date: new Date(),
        requester_name: 'Test Requester',
        department: 'Engineering',
        project: 'Test Project',
        status: 'Pending',
        created_by: testUser.id
      })
      .returning()
      .execute();
    testMof = mofs[0];

    // Create test item
    const items = await db.insert(itemsTable)
      .values({
        part_number: 'PART-001',
        supplier: 'Test Supplier',
        serial_number: 'ITEM-001'
      })
      .returning()
      .execute();
    testItem = items[0];
  });

  afterEach(resetDB);

  it('should scan item successfully', async () => {
    const input: ScanItemInput = {
      mof_serial_number: 'MOF-001',
      item_serial_number: 'ITEM-001',
      picked_by: testUser.id
    };

    const result = await scanItem(input);

    // Verify item is updated
    expect(result.id).toBe(testItem.id);
    expect(result.serial_number).toBe('ITEM-001');
    expect(result.is_scanned_by_picker).toBe(true);
    expect(result.is_scanned_by_requester).toBe(false);
    expect(result.mof_id).toBe(testMof.id);
    expect(result.picked_at).toBeInstanceOf(Date);
    expect(result.verified_at).toBeNull();
  });

  it('should create pick record', async () => {
    const input: ScanItemInput = {
      mof_serial_number: 'MOF-001',
      item_serial_number: 'ITEM-001',
      picked_by: testUser.id
    };

    await scanItem(input);

    // Verify pick record was created
    const pickRecords = await db.select()
      .from(pickRecordsTable)
      .where(and(
        eq(pickRecordsTable.mof_id, testMof.id),
        eq(pickRecordsTable.item_id, testItem.id)
      ))
      .execute();

    expect(pickRecords).toHaveLength(1);
    expect(pickRecords[0].picked_by).toBe(testUser.id);
    expect(pickRecords[0].picked_at).toBeInstanceOf(Date);
  });

  it('should update MOF status to In Progress on first pick', async () => {
    const input: ScanItemInput = {
      mof_serial_number: 'MOF-001',
      item_serial_number: 'ITEM-001',
      picked_by: testUser.id
    };

    await scanItem(input);

    // Verify MOF status is updated
    const mofs = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, testMof.id))
      .execute();

    expect(mofs[0].status).toBe('In Progress');
  });

  it('should update MOF status to MOF siap Supply when all items picked', async () => {
    // Create second item for the same MOF
    const secondItems = await db.insert(itemsTable)
      .values({
        part_number: 'PART-001',
        supplier: 'Test Supplier',
        serial_number: 'ITEM-002'
      })
      .returning()
      .execute();

    // Scan first item
    await scanItem({
      mof_serial_number: 'MOF-001',
      item_serial_number: 'ITEM-001',
      picked_by: testUser.id
    });

    // Scan second item (should complete the MOF)
    await scanItem({
      mof_serial_number: 'MOF-001',
      item_serial_number: 'ITEM-002',
      picked_by: testUser.id
    });

    // Verify MOF status is updated to completed
    const mofs = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, testMof.id))
      .execute();

    expect(mofs[0].status).toBe('MOF siap Supply');
  });

  it('should throw error when MOF not found', async () => {
    const input: ScanItemInput = {
      mof_serial_number: 'NON-EXISTENT',
      item_serial_number: 'ITEM-001',
      picked_by: testUser.id
    };

    expect(scanItem(input)).rejects.toThrow(/MOF with serial number NON-EXISTENT not found/i);
  });

  it('should throw error when item not found', async () => {
    const input: ScanItemInput = {
      mof_serial_number: 'MOF-001',
      item_serial_number: 'NON-EXISTENT',
      picked_by: testUser.id
    };

    expect(scanItem(input)).rejects.toThrow(/Item with serial number NON-EXISTENT not found/i);
  });

  it('should throw error when part numbers do not match', async () => {
    // Create item with different part number
    const mismatchedItems = await db.insert(itemsTable)
      .values({
        part_number: 'DIFFERENT-PART',
        supplier: 'Test Supplier',
        serial_number: 'MISMATCHED-ITEM'
      })
      .returning()
      .execute();

    const input: ScanItemInput = {
      mof_serial_number: 'MOF-001',
      item_serial_number: 'MISMATCHED-ITEM',
      picked_by: testUser.id
    };

    expect(scanItem(input)).rejects.toThrow(/Item part number DIFFERENT-PART does not match MOF part number PART-001/i);
  });

  it('should throw error when item already scanned', async () => {
    // First scan should succeed
    const input: ScanItemInput = {
      mof_serial_number: 'MOF-001',
      item_serial_number: 'ITEM-001',
      picked_by: testUser.id
    };

    await scanItem(input);

    // Second scan of same item should fail
    expect(scanItem(input)).rejects.toThrow(/Item with serial number ITEM-001 has already been scanned by picker/i);
  });

  it('should handle single item MOF correctly', async () => {
    // Create MOF with quantity 1
    const singleMofs = await db.insert(mofsTable)
      .values({
        serial_number: 'SINGLE-MOF',
        part_number: 'SINGLE-PART',
        quantity_requested: 1,
        expected_receiving_date: new Date(),
        requester_name: 'Test Requester',
        department: 'Engineering',
        project: 'Single Item Project',
        status: 'Pending',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Create matching item
    await db.insert(itemsTable)
      .values({
        part_number: 'SINGLE-PART',
        supplier: 'Single Supplier',
        serial_number: 'SINGLE-ITEM'
      })
      .execute();

    // Scan the item
    await scanItem({
      mof_serial_number: 'SINGLE-MOF',
      item_serial_number: 'SINGLE-ITEM',
      picked_by: testUser.id
    });

    // Verify MOF status goes directly to MOF siap Supply
    const mofs = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, singleMofs[0].id))
      .execute();

    expect(mofs[0].status).toBe('MOF siap Supply');
  });
});