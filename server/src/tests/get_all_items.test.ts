import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { itemsTable, usersTable, mofsTable } from '../db/schema';
import { getAllItems } from '../handlers/get_all_items';

describe('getAllItems', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no items exist', async () => {
    const result = await getAllItems();
    
    expect(result).toEqual([]);
  });

  it('should return all items when items exist', async () => {
    // Create test items
    await db.insert(itemsTable).values([
      {
        part_number: 'PART-001',
        supplier: 'Supplier A',
        serial_number: 'SN-001',
        is_scanned_by_picker: false,
        is_scanned_by_requester: false,
        mof_id: null,
        picked_at: null,
        verified_at: null
      },
      {
        part_number: 'PART-002',
        supplier: 'Supplier B',
        serial_number: 'SN-002',
        is_scanned_by_picker: true,
        is_scanned_by_requester: false,
        mof_id: null,
        picked_at: new Date('2024-01-01T10:00:00Z'),
        verified_at: null
      }
    ]).execute();

    const result = await getAllItems();

    expect(result).toHaveLength(2);
    
    // Check first item
    expect(result[0].part_number).toEqual('PART-001');
    expect(result[0].supplier).toEqual('Supplier A');
    expect(result[0].serial_number).toEqual('SN-001');
    expect(result[0].is_scanned_by_picker).toEqual(false);
    expect(result[0].is_scanned_by_requester).toEqual(false);
    expect(result[0].mof_id).toBeNull();
    expect(result[0].picked_at).toBeNull();
    expect(result[0].verified_at).toBeNull();
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    // Check second item
    expect(result[1].part_number).toEqual('PART-002');
    expect(result[1].supplier).toEqual('Supplier B');
    expect(result[1].serial_number).toEqual('SN-002');
    expect(result[1].is_scanned_by_picker).toEqual(true);
    expect(result[1].is_scanned_by_requester).toEqual(false);
    expect(result[1].mof_id).toBeNull();
    expect(result[1].picked_at).toBeInstanceOf(Date);
    expect(result[1].verified_at).toBeNull();
  });

  it('should return items with MOF associations', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'Admin'
    }).returning().execute();

    const userId = userResult[0].id;

    // Create prerequisite MOF
    const mofResult = await db.insert(mofsTable).values({
      serial_number: 'MOF-001',
      part_number: 'PART-001',
      quantity_requested: 5,
      expected_receiving_date: new Date('2024-02-01'),
      requester_name: 'John Doe',
      department: 'Engineering',
      project: 'Project X',
      status: 'In Progress',
      created_by: userId
    }).returning().execute();

    const mofId = mofResult[0].id;

    // Create item associated with MOF
    await db.insert(itemsTable).values({
      part_number: 'PART-001',
      supplier: 'Supplier C',
      serial_number: 'SN-003',
      is_scanned_by_picker: true,
      is_scanned_by_requester: true,
      mof_id: mofId,
      picked_at: new Date('2024-01-15T10:00:00Z'),
      verified_at: new Date('2024-01-15T14:00:00Z')
    }).execute();

    const result = await getAllItems();

    expect(result).toHaveLength(1);
    expect(result[0].part_number).toEqual('PART-001');
    expect(result[0].supplier).toEqual('Supplier C');
    expect(result[0].serial_number).toEqual('SN-003');
    expect(result[0].is_scanned_by_picker).toEqual(true);
    expect(result[0].is_scanned_by_requester).toEqual(true);
    expect(result[0].mof_id).toEqual(mofId);
    expect(result[0].picked_at).toBeInstanceOf(Date);
    expect(result[0].verified_at).toBeInstanceOf(Date);
  });

  it('should handle mixed item states correctly', async () => {
    // Create user for MOF
    const userResult = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'Admin'
    }).returning().execute();

    const userId = userResult[0].id;

    // Create MOF
    const mofResult = await db.insert(mofsTable).values({
      serial_number: 'MOF-002',
      part_number: 'PART-002',
      quantity_requested: 3,
      expected_receiving_date: new Date('2024-02-15'),
      requester_name: 'Jane Smith',
      department: 'Operations',
      project: 'Project Y',
      status: 'Pending',
      created_by: userId
    }).returning().execute();

    const mofId = mofResult[0].id;

    // Create items in various states
    await db.insert(itemsTable).values([
      // Unprocessed item
      {
        part_number: 'PART-003',
        supplier: 'Supplier D',
        serial_number: 'SN-004',
        is_scanned_by_picker: false,
        is_scanned_by_requester: false,
        mof_id: null,
        picked_at: null,
        verified_at: null
      },
      // Picked but not verified
      {
        part_number: 'PART-004',
        supplier: 'Supplier E',
        serial_number: 'SN-005',
        is_scanned_by_picker: true,
        is_scanned_by_requester: false,
        mof_id: mofId,
        picked_at: new Date('2024-01-20T09:00:00Z'),
        verified_at: null
      },
      // Fully processed
      {
        part_number: 'PART-005',
        supplier: 'Supplier F',
        serial_number: 'SN-006',
        is_scanned_by_picker: true,
        is_scanned_by_requester: true,
        mof_id: mofId,
        picked_at: new Date('2024-01-20T09:30:00Z'),
        verified_at: new Date('2024-01-20T15:00:00Z')
      }
    ]).execute();

    const result = await getAllItems();

    expect(result).toHaveLength(3);

    // Find items by serial number for reliable testing
    const unprocessedItem = result.find(item => item.serial_number === 'SN-004');
    const pickedItem = result.find(item => item.serial_number === 'SN-005');
    const fullyProcessedItem = result.find(item => item.serial_number === 'SN-006');

    // Verify unprocessed item
    expect(unprocessedItem).toBeDefined();
    expect(unprocessedItem!.is_scanned_by_picker).toEqual(false);
    expect(unprocessedItem!.is_scanned_by_requester).toEqual(false);
    expect(unprocessedItem!.mof_id).toBeNull();
    expect(unprocessedItem!.picked_at).toBeNull();
    expect(unprocessedItem!.verified_at).toBeNull();

    // Verify picked item
    expect(pickedItem).toBeDefined();
    expect(pickedItem!.is_scanned_by_picker).toEqual(true);
    expect(pickedItem!.is_scanned_by_requester).toEqual(false);
    expect(pickedItem!.mof_id).toEqual(mofId);
    expect(pickedItem!.picked_at).toBeInstanceOf(Date);
    expect(pickedItem!.verified_at).toBeNull();

    // Verify fully processed item
    expect(fullyProcessedItem).toBeDefined();
    expect(fullyProcessedItem!.is_scanned_by_picker).toEqual(true);
    expect(fullyProcessedItem!.is_scanned_by_requester).toEqual(true);
    expect(fullyProcessedItem!.mof_id).toEqual(mofId);
    expect(fullyProcessedItem!.picked_at).toBeInstanceOf(Date);
    expect(fullyProcessedItem!.verified_at).toBeInstanceOf(Date);
  });

  it('should preserve item creation order', async () => {
    const now = new Date();
    
    // Create items with slight time differences
    await db.insert(itemsTable).values({
      part_number: 'PART-FIRST',
      supplier: 'Supplier First',
      serial_number: 'SN-FIRST',
      is_scanned_by_picker: false,
      is_scanned_by_requester: false,
      mof_id: null,
      picked_at: null,
      verified_at: null
    }).execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(itemsTable).values({
      part_number: 'PART-SECOND',
      supplier: 'Supplier Second',
      serial_number: 'SN-SECOND',
      is_scanned_by_picker: false,
      is_scanned_by_requester: false,
      mof_id: null,
      picked_at: null,
      verified_at: null
    }).execute();

    const result = await getAllItems();

    expect(result).toHaveLength(2);
    
    // Items should maintain their database insertion order
    expect(result[0].serial_number).toEqual('SN-FIRST');
    expect(result[1].serial_number).toEqual('SN-SECOND');
    
    // Verify timestamps are in chronological order
    expect(result[0].created_at.getTime()).toBeLessThanOrEqual(result[1].created_at.getTime());
  });
});