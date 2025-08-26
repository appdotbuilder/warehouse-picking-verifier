import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, mofsTable } from '../db/schema';
import { type CreateUserInput, type CreateMofInput } from '../schema';
import { getAllMofs } from '../handlers/get_all_mofs';

// Test user data
const testUser: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'Admin'
};

// Test MOF data
const testMof1: CreateMofInput = {
  part_number: 'PART-001',
  quantity_requested: 10,
  expected_receiving_date: new Date('2024-01-15'),
  requester_name: 'John Doe',
  department: 'Engineering',
  project: 'Project Alpha',
  created_by: 1
};

const testMof2: CreateMofInput = {
  part_number: 'PART-002',
  quantity_requested: 5,
  expected_receiving_date: new Date('2024-01-20'),
  requester_name: 'Jane Smith',
  department: 'Manufacturing',
  project: 'Project Beta',
  created_by: 1
};

describe('getAllMofs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;

  beforeEach(async () => {
    // Create test user first (required for foreign key)
    const userResult = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        full_name: testUser.full_name,
        role: testUser.role
      })
      .returning()
      .execute();
    
    userId = userResult[0].id;
  });

  it('should return empty array when no MOFs exist', async () => {
    const result = await getAllMofs();
    
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should fetch all MOFs from database', async () => {
    // Create test MOFs
    await db.insert(mofsTable)
      .values([
        {
          ...testMof1,
          serial_number: 'MOF-001',
          created_by: userId
        },
        {
          ...testMof2,
          serial_number: 'MOF-002', 
          created_by: userId
        }
      ])
      .execute();

    const result = await getAllMofs();

    expect(result).toHaveLength(2);
    
    // Find MOFs by serial number for consistent testing (since order might vary with same timestamp)
    const mof1 = result.find(m => m.serial_number === 'MOF-001');
    const mof2 = result.find(m => m.serial_number === 'MOF-002');

    expect(mof1).toBeDefined();
    expect(mof2).toBeDefined();
    
    // Verify MOF-001
    expect(mof1!.part_number).toEqual('PART-001');
    expect(mof1!.quantity_requested).toEqual(10);
    expect(mof1!.requester_name).toEqual('John Doe');
    expect(mof1!.department).toEqual('Engineering');
    expect(mof1!.project).toEqual('Project Alpha');
    expect(mof1!.status).toEqual('Pending');
    expect(mof1!.created_by).toEqual(userId);
    expect(mof1!.id).toBeDefined();
    expect(mof1!.created_at).toBeInstanceOf(Date);
    expect(mof1!.updated_at).toBeInstanceOf(Date);

    // Verify MOF-002
    expect(mof2!.part_number).toEqual('PART-002');
    expect(mof2!.quantity_requested).toEqual(5);
    expect(mof2!.requester_name).toEqual('Jane Smith');
    expect(mof2!.department).toEqual('Manufacturing');
    expect(mof2!.project).toEqual('Project Beta');
  });

  it('should return MOFs ordered by creation date (newest first)', async () => {
    // Create MOFs with slight delay to ensure different timestamps
    await db.insert(mofsTable)
      .values({
        ...testMof1,
        serial_number: 'MOF-001',
        created_by: userId
      })
      .execute();

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(mofsTable)
      .values({
        ...testMof2,
        serial_number: 'MOF-002',
        created_by: userId
      })
      .execute();

    const result = await getAllMofs();

    expect(result).toHaveLength(2);
    
    // Verify ordering - newer MOF should be first
    expect(result[0].serial_number).toEqual('MOF-002');
    expect(result[1].serial_number).toEqual('MOF-001');
    
    // Verify timestamps are in descending order
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should include all MOF fields in response', async () => {
    await db.insert(mofsTable)
      .values({
        ...testMof1,
        serial_number: 'MOF-001',
        created_by: userId
      })
      .execute();

    const result = await getAllMofs();
    const mof = result[0];

    // Verify all required fields are present
    expect(mof.id).toBeDefined();
    expect(mof.serial_number).toBeDefined();
    expect(mof.part_number).toBeDefined();
    expect(mof.quantity_requested).toBeDefined();
    expect(mof.expected_receiving_date).toBeDefined();
    expect(mof.requester_name).toBeDefined();
    expect(mof.department).toBeDefined();
    expect(mof.project).toBeDefined();
    expect(mof.status).toBeDefined();
    expect(mof.created_by).toBeDefined();
    expect(mof.created_at).toBeDefined();
    expect(mof.updated_at).toBeDefined();

    // Verify field types
    expect(typeof mof.id).toBe('number');
    expect(typeof mof.serial_number).toBe('string');
    expect(typeof mof.part_number).toBe('string');
    expect(typeof mof.quantity_requested).toBe('number');
    expect(mof.expected_receiving_date).toBeInstanceOf(Date);
    expect(typeof mof.requester_name).toBe('string');
    expect(typeof mof.department).toBe('string');
    expect(typeof mof.project).toBe('string');
    expect(typeof mof.status).toBe('string');
    expect(typeof mof.created_by).toBe('number');
    expect(mof.created_at).toBeInstanceOf(Date);
    expect(mof.updated_at).toBeInstanceOf(Date);
  });

  it('should handle MOFs with different statuses', async () => {
    // Create MOFs with different statuses
    await db.insert(mofsTable)
      .values([
        {
          ...testMof1,
          serial_number: 'MOF-001',
          created_by: userId,
          status: 'Pending'
        },
        {
          ...testMof2,
          serial_number: 'MOF-002',
          created_by: userId,
          status: 'In Progress'
        }
      ])
      .execute();

    const result = await getAllMofs();

    expect(result).toHaveLength(2);
    
    // Find MOFs by serial number for consistent testing
    const mof1 = result.find(m => m.serial_number === 'MOF-001');
    const mof2 = result.find(m => m.serial_number === 'MOF-002');

    expect(mof1?.status).toEqual('Pending');
    expect(mof2?.status).toEqual('In Progress');
  });
});