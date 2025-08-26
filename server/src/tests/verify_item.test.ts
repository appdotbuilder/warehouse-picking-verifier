import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, mofsTable, itemsTable, verificationRecordsTable } from '../db/schema';
import { type VerifyItemInput } from '../schema';
import { verifyItem } from '../handlers/verify_item';
import { eq, and } from 'drizzle-orm';

describe('verifyItem', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let testMof: any;
  let testItem: any;

  beforeEach(async () => {
    // Create a test user
    const userResults = await db.insert(usersTable)
      .values({
        username: 'testverifier',
        email: 'verifier@test.com',
        full_name: 'Test Verifier',
        role: 'Requester'
      })
      .returning()
      .execute();
    testUser = userResults[0];

    // Create a test MOF
    const mofResults = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-2024-001',
        part_number: 'PART-001',
        quantity_requested: 2,
        expected_receiving_date: new Date(),
        requester_name: 'Test Requester',
        department: 'Engineering',
        project: 'Test Project',
        status: 'In Progress',
        created_by: testUser.id
      })
      .returning()
      .execute();
    testMof = mofResults[0];

    // Create a test item that has been picked
    const itemResults = await db.insert(itemsTable)
      .values({
        part_number: 'PART-001',
        supplier: 'Test Supplier',
        serial_number: 'ITEM-001',
        is_scanned_by_picker: true,
        is_scanned_by_requester: false,
        mof_id: testMof.id,
        picked_at: new Date()
      })
      .returning()
      .execute();
    testItem = itemResults[0];
  });

  const testInput: VerifyItemInput = {
    mof_serial_number: 'MOF-2024-001',
    item_serial_number: 'ITEM-001',
    verified_by: 1 // Will be updated in tests
  };

  it('should verify an item successfully', async () => {
    const input = { ...testInput, verified_by: testUser.id };
    
    const result = await verifyItem(input);

    // Basic field validation
    expect(result.id).toEqual(testItem.id);
    expect(result.serial_number).toEqual('ITEM-001');
    expect(result.is_scanned_by_picker).toBe(true);
    expect(result.is_scanned_by_requester).toBe(true);
    expect(result.verified_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a verification record', async () => {
    const input = { ...testInput, verified_by: testUser.id };
    
    await verifyItem(input);

    // Check that verification record was created
    const verificationRecords = await db.select()
      .from(verificationRecordsTable)
      .where(and(
        eq(verificationRecordsTable.mof_id, testMof.id),
        eq(verificationRecordsTable.item_id, testItem.id)
      ))
      .execute();

    expect(verificationRecords).toHaveLength(1);
    expect(verificationRecords[0].verified_by).toEqual(testUser.id);
    expect(verificationRecords[0].verified_at).toBeInstanceOf(Date);
  });

  it('should update MOF status to Completed when all requested items are verified', async () => {
    const input = { ...testInput, verified_by: testUser.id };
    
    // Verify the single item (MOF has quantity_requested: 2, but only 1 item exists)
    await verifyItem(input);

    // Check MOF status - should remain 'In Progress' since we only have 1 verified item but requested 2
    const mofResults = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, testMof.id))
      .execute();

    expect(mofResults[0].status).toEqual('In Progress');

    // Now create and verify a second item to complete the MOF
    await db.insert(itemsTable)
      .values({
        part_number: 'PART-001',
        supplier: 'Test Supplier',
        serial_number: 'ITEM-002',
        is_scanned_by_picker: true,
        is_scanned_by_requester: false,
        mof_id: testMof.id,
        picked_at: new Date()
      })
      .execute();

    // Verify the second item
    const secondInput = {
      ...testInput,
      item_serial_number: 'ITEM-002',
      verified_by: testUser.id
    };

    await verifyItem(secondInput);

    // Now check that MOF status is updated to 'Completed' after 2 items verified (meeting quantity_requested)
    const updatedMofResults = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, testMof.id))
      .execute();

    expect(updatedMofResults[0].status).toEqual('Completed');
  });

  it('should complete MOF immediately when quantity_requested is met', async () => {
    // Create a MOF that only requests 1 item
    const singleItemMofResults = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-SINGLE-001',
        part_number: 'PART-SINGLE',
        quantity_requested: 1, // Only 1 item requested
        expected_receiving_date: new Date(),
        requester_name: 'Single Item Requester',
        department: 'Engineering',
        project: 'Single Item Project',
        status: 'In Progress',
        created_by: testUser.id
      })
      .returning()
      .execute();
    
    const singleItemMof = singleItemMofResults[0];

    // Create and verify the single item
    await db.insert(itemsTable)
      .values({
        part_number: 'PART-SINGLE',
        supplier: 'Test Supplier',
        serial_number: 'SINGLE-ITEM',
        is_scanned_by_picker: true,
        is_scanned_by_requester: false,
        mof_id: singleItemMof.id,
        picked_at: new Date()
      })
      .execute();

    const singleItemInput = {
      mof_serial_number: 'MOF-SINGLE-001',
      item_serial_number: 'SINGLE-ITEM',
      verified_by: testUser.id
    };

    await verifyItem(singleItemInput);

    // Check that MOF status is immediately updated to 'Completed'
    const mofResults = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, singleItemMof.id))
      .execute();

    expect(mofResults[0].status).toEqual('Completed');
  });

  it('should throw error when MOF not found', async () => {
    const input = {
      ...testInput,
      mof_serial_number: 'NONEXISTENT-MOF',
      verified_by: testUser.id
    };

    await expect(verifyItem(input)).rejects.toThrow(/MOF with serial number NONEXISTENT-MOF not found/i);
  });

  it('should throw error when item not found', async () => {
    const input = {
      ...testInput,
      item_serial_number: 'NONEXISTENT-ITEM',
      verified_by: testUser.id
    };

    await expect(verifyItem(input)).rejects.toThrow(/Item with serial number NONEXISTENT-ITEM not found/i);
  });

  it('should throw error when item does not belong to specified MOF', async () => {
    // Create another MOF
    const anotherMofResults = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-2024-002',
        part_number: 'PART-002',
        quantity_requested: 1,
        expected_receiving_date: new Date(),
        requester_name: 'Another Requester',
        department: 'Engineering',
        project: 'Another Project',
        status: 'In Progress',
        created_by: testUser.id
      })
      .returning()
      .execute();

    // Create item belonging to the other MOF
    await db.insert(itemsTable)
      .values({
        part_number: 'PART-002',
        supplier: 'Test Supplier',
        serial_number: 'ITEM-OTHER',
        is_scanned_by_picker: true,
        is_scanned_by_requester: false,
        mof_id: anotherMofResults[0].id,
        picked_at: new Date()
      })
      .execute();

    const input = {
      mof_serial_number: 'MOF-2024-001', // Original MOF
      item_serial_number: 'ITEM-OTHER', // Item from different MOF
      verified_by: testUser.id
    };

    await expect(verifyItem(input)).rejects.toThrow(/Item ITEM-OTHER does not belong to MOF MOF-2024-001/i);
  });

  it('should throw error when item has not been picked yet', async () => {
    // Create an unpicked item
    await db.insert(itemsTable)
      .values({
        part_number: 'PART-001',
        supplier: 'Test Supplier',
        serial_number: 'UNPICKED-ITEM',
        is_scanned_by_picker: false,
        is_scanned_by_requester: false,
        mof_id: testMof.id
      })
      .execute();

    const input = {
      ...testInput,
      item_serial_number: 'UNPICKED-ITEM',
      verified_by: testUser.id
    };

    await expect(verifyItem(input)).rejects.toThrow(/Item UNPICKED-ITEM has not been picked yet/i);
  });

  it('should throw error when item is already verified', async () => {
    const input = { ...testInput, verified_by: testUser.id };
    
    // Verify the item first time
    await verifyItem(input);

    // Try to verify the same item again
    await expect(verifyItem(input)).rejects.toThrow(/Item ITEM-001 has already been verified/i);
  });

  it('should update item timestamps correctly', async () => {
    const input = { ...testInput, verified_by: testUser.id };
    
    const beforeVerification = new Date();
    const result = await verifyItem(input);

    expect(result.verified_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.verified_at!.getTime()).toBeGreaterThanOrEqual(beforeVerification.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeVerification.getTime());
  });

  it('should preserve existing item data during verification', async () => {
    const input = { ...testInput, verified_by: testUser.id };
    
    const result = await verifyItem(input);

    expect(result.part_number).toEqual(testItem.part_number);
    expect(result.supplier).toEqual(testItem.supplier);
    expect(result.mof_id).toEqual(testItem.mof_id);
    expect(result.picked_at).toEqual(testItem.picked_at);
    expect(result.created_at).toEqual(testItem.created_at);
  });
});