import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, mofsTable, itemsTable } from '../db/schema';
import { type GetMofProgressInput } from '../schema';
import { getMofProgress } from '../handlers/get_mof_progress';

describe('getMofProgress', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent MOF', async () => {
    const input: GetMofProgressInput = {
      mof_id: 999
    };

    const result = await getMofProgress(input);
    expect(result).toBeNull();
  });

  it('should return MOF progress with no items', async () => {
    // Create a user first
    const users = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    const user = users[0];

    // Create a MOF without items
    const mofs = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-001',
        part_number: 'PART-001',
        quantity_requested: 5,
        expected_receiving_date: new Date(),
        requester_name: 'John Doe',
        department: 'Engineering',
        project: 'Project A',
        status: 'Pending',
        created_by: user.id
      })
      .returning()
      .execute();

    const mof = mofs[0];

    const input: GetMofProgressInput = {
      mof_id: mof.id
    };

    const result = await getMofProgress(input);

    expect(result).not.toBeNull();
    expect(result!.mof.id).toEqual(mof.id);
    expect(result!.mof.serial_number).toEqual('MOF-001');
    expect(result!.quantity_requested).toEqual(5);
    expect(result!.quantity_picked).toEqual(0);
    expect(result!.quantity_verified).toEqual(0);
    expect(result!.items_picked).toHaveLength(0);
    expect(result!.items_verified).toHaveLength(0);
  });

  it('should return correct progress with mixed item states', async () => {
    // Create a user
    const users = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    const user = users[0];

    // Create a MOF
    const mofs = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-002',
        part_number: 'PART-002',
        quantity_requested: 4,
        expected_receiving_date: new Date(),
        requester_name: 'Jane Smith',
        department: 'Manufacturing',
        project: 'Project B',
        status: 'In Progress',
        created_by: user.id
      })
      .returning()
      .execute();

    const mof = mofs[0];

    // Create items with different states
    const items = await db.insert(itemsTable)
      .values([
        {
          part_number: 'PART-002',
          supplier: 'Supplier A',
          serial_number: 'ITEM-001',
          is_scanned_by_picker: false,
          is_scanned_by_requester: false,
          mof_id: mof.id
        },
        {
          part_number: 'PART-002',
          supplier: 'Supplier A',
          serial_number: 'ITEM-002',
          is_scanned_by_picker: true,
          is_scanned_by_requester: false,
          mof_id: mof.id,
          picked_at: new Date()
        },
        {
          part_number: 'PART-002',
          supplier: 'Supplier A',
          serial_number: 'ITEM-003',
          is_scanned_by_picker: true,
          is_scanned_by_requester: true,
          mof_id: mof.id,
          picked_at: new Date(),
          verified_at: new Date()
        },
        {
          part_number: 'PART-002',
          supplier: 'Supplier B',
          serial_number: 'ITEM-004',
          is_scanned_by_picker: true,
          is_scanned_by_requester: false,
          mof_id: mof.id,
          picked_at: new Date()
        }
      ])
      .returning()
      .execute();

    const input: GetMofProgressInput = {
      mof_id: mof.id
    };

    const result = await getMofProgress(input);

    expect(result).not.toBeNull();
    expect(result!.mof.id).toEqual(mof.id);
    expect(result!.mof.serial_number).toEqual('MOF-002');
    expect(result!.quantity_requested).toEqual(4);
    expect(result!.quantity_picked).toEqual(3); // 3 items picked
    expect(result!.quantity_verified).toEqual(1); // 1 item verified
    
    // Check picked items
    expect(result!.items_picked).toHaveLength(3);
    const pickedSerials = result!.items_picked.map(item => item.serial_number).sort();
    expect(pickedSerials).toEqual(['ITEM-002', 'ITEM-003', 'ITEM-004']);

    // Check verified items
    expect(result!.items_verified).toHaveLength(1);
    expect(result!.items_verified[0].serial_number).toEqual('ITEM-003');
    expect(result!.items_verified[0].is_scanned_by_requester).toBe(true);
  });

  it('should only include items belonging to the specified MOF', async () => {
    // Create a user
    const users = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    const user = users[0];

    // Create two MOFs
    const mofs = await db.insert(mofsTable)
      .values([
        {
          serial_number: 'MOF-003',
          part_number: 'PART-003',
          quantity_requested: 2,
          expected_receiving_date: new Date(),
          requester_name: 'Alice Brown',
          department: 'Quality',
          project: 'Project C',
          status: 'Pending',
          created_by: user.id
        },
        {
          serial_number: 'MOF-004',
          part_number: 'PART-004',
          quantity_requested: 3,
          expected_receiving_date: new Date(),
          requester_name: 'Bob Wilson',
          department: 'Testing',
          project: 'Project D',
          status: 'Pending',
          created_by: user.id
        }
      ])
      .returning()
      .execute();

    const mof1 = mofs[0];
    const mof2 = mofs[1];

    // Create items for both MOFs
    await db.insert(itemsTable)
      .values([
        // Items for MOF 1
        {
          part_number: 'PART-003',
          supplier: 'Supplier C',
          serial_number: 'ITEM-005',
          is_scanned_by_picker: true,
          is_scanned_by_requester: false,
          mof_id: mof1.id,
          picked_at: new Date()
        },
        {
          part_number: 'PART-003',
          supplier: 'Supplier C',
          serial_number: 'ITEM-006',
          is_scanned_by_picker: true,
          is_scanned_by_requester: true,
          mof_id: mof1.id,
          picked_at: new Date(),
          verified_at: new Date()
        },
        // Items for MOF 2
        {
          part_number: 'PART-004',
          supplier: 'Supplier D',
          serial_number: 'ITEM-007',
          is_scanned_by_picker: true,
          is_scanned_by_requester: false,
          mof_id: mof2.id,
          picked_at: new Date()
        }
      ])
      .execute();

    // Get progress for MOF 1
    const input: GetMofProgressInput = {
      mof_id: mof1.id
    };

    const result = await getMofProgress(input);

    expect(result).not.toBeNull();
    expect(result!.mof.id).toEqual(mof1.id);
    expect(result!.quantity_requested).toEqual(2);
    expect(result!.quantity_picked).toEqual(2);
    expect(result!.quantity_verified).toEqual(1);
    
    // Should only include items from MOF 1
    const pickedSerials = result!.items_picked.map(item => item.serial_number).sort();
    expect(pickedSerials).toEqual(['ITEM-005', 'ITEM-006']);
    
    const verifiedSerials = result!.items_verified.map(item => item.serial_number);
    expect(verifiedSerials).toEqual(['ITEM-006']);
  });

  it('should handle MOF with all items fully processed', async () => {
    // Create a user
    const users = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    const user = users[0];

    // Create a completed MOF
    const mofs = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-005',
        part_number: 'PART-005',
        quantity_requested: 2,
        expected_receiving_date: new Date(),
        requester_name: 'Charlie Davis',
        department: 'Operations',
        project: 'Project E',
        status: 'Completed',
        created_by: user.id
      })
      .returning()
      .execute();

    const mof = mofs[0];

    // Create items that are all picked and verified
    await db.insert(itemsTable)
      .values([
        {
          part_number: 'PART-005',
          supplier: 'Supplier E',
          serial_number: 'ITEM-008',
          is_scanned_by_picker: true,
          is_scanned_by_requester: true,
          mof_id: mof.id,
          picked_at: new Date(),
          verified_at: new Date()
        },
        {
          part_number: 'PART-005',
          supplier: 'Supplier E',
          serial_number: 'ITEM-009',
          is_scanned_by_picker: true,
          is_scanned_by_requester: true,
          mof_id: mof.id,
          picked_at: new Date(),
          verified_at: new Date()
        }
      ])
      .execute();

    const input: GetMofProgressInput = {
      mof_id: mof.id
    };

    const result = await getMofProgress(input);

    expect(result).not.toBeNull();
    expect(result!.mof.status).toEqual('Completed');
    expect(result!.quantity_requested).toEqual(2);
    expect(result!.quantity_picked).toEqual(2);
    expect(result!.quantity_verified).toEqual(2);
    expect(result!.items_picked).toHaveLength(2);
    expect(result!.items_verified).toHaveLength(2);
    
    // All items should be both picked and verified
    result!.items_picked.forEach(item => {
      expect(item.is_scanned_by_picker).toBe(true);
    });
    
    result!.items_verified.forEach(item => {
      expect(item.is_scanned_by_requester).toBe(true);
    });
  });
});