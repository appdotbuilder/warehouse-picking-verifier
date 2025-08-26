import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, mofsTable } from '../db/schema';
import { type CreateUserInput, type CreateMofInput } from '../schema';
import { getUserMofs } from '../handlers/get_user_mofs';
import { eq } from 'drizzle-orm';

// Test users
const testUser1: CreateUserInput = {
  username: 'john_doe',
  email: 'john@example.com',
  full_name: 'John Doe',
  role: 'Requester'
};

const testUser2: CreateUserInput = {
  username: 'jane_smith',
  email: 'jane@example.com',
  full_name: 'Jane Smith',
  role: 'Requester'
};

// Test MOF inputs
const testMof1: CreateMofInput = {
  part_number: 'PART-001',
  quantity_requested: 5,
  expected_receiving_date: new Date('2024-01-15'),
  requester_name: 'John Doe',
  department: 'Engineering',
  project: 'Project Alpha',
  created_by: 1 // Will be updated with actual user ID
};

const testMof2: CreateMofInput = {
  part_number: 'PART-002',
  quantity_requested: 10,
  expected_receiving_date: new Date('2024-01-20'),
  requester_name: 'John Doe',
  department: 'Engineering',
  project: 'Project Beta',
  created_by: 1 // Will be updated with actual user ID
};

const testMof3: CreateMofInput = {
  part_number: 'PART-003',
  quantity_requested: 3,
  expected_receiving_date: new Date('2024-01-25'),
  requester_name: 'Jane Smith',
  department: 'Manufacturing',
  project: 'Project Gamma',
  created_by: 2 // Will be updated with actual user ID
};

describe('getUserMofs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return MOFs created by specific user', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();
    
    const user2Result = await db.insert(usersTable)
      .values(testUser2)
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create MOFs for different users
    await db.insert(mofsTable)
      .values([
        {
          ...testMof1,
          created_by: user1Id,
          serial_number: 'MOF-001'
        },
        {
          ...testMof2,
          created_by: user1Id,
          serial_number: 'MOF-002'
        },
        {
          ...testMof3,
          created_by: user2Id,
          serial_number: 'MOF-003'
        }
      ])
      .execute();

    // Get MOFs for user1
    const user1Mofs = await getUserMofs(user1Id);

    // Should return only user1's MOFs
    expect(user1Mofs).toHaveLength(2);
    expect(user1Mofs.every(mof => mof.created_by === user1Id)).toBe(true);
    
    // Check specific MOF data
    const mofPartNumbers = user1Mofs.map(mof => mof.part_number).sort();
    expect(mofPartNumbers).toEqual(['PART-001', 'PART-002']);

    // Verify all required fields are present
    user1Mofs.forEach(mof => {
      expect(mof.id).toBeDefined();
      expect(mof.serial_number).toBeDefined();
      expect(mof.part_number).toBeDefined();
      expect(mof.quantity_requested).toBeDefined();
      expect(mof.expected_receiving_date).toBeInstanceOf(Date);
      expect(mof.requester_name).toBeDefined();
      expect(mof.department).toBeDefined();
      expect(mof.project).toBeDefined();
      expect(mof.status).toBeDefined();
      expect(mof.created_by).toBe(user1Id);
      expect(mof.created_at).toBeInstanceOf(Date);
      expect(mof.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array for user with no MOFs', async () => {
    // Create a user but no MOFs
    const userResult = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const userId = userResult[0].id;
    const result = await getUserMofs(userId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return MOFs ordered by creation date (newest first)', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create MOFs with different timestamps
    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // 1 minute earlier

    // Insert first MOF (older)
    await db.insert(mofsTable)
      .values({
        ...testMof1,
        created_by: userId,
        serial_number: 'MOF-OLD',
        created_at: earlier,
        updated_at: earlier
      })
      .execute();

    // Insert second MOF (newer)
    await db.insert(mofsTable)
      .values({
        ...testMof2,
        created_by: userId,
        serial_number: 'MOF-NEW',
        created_at: now,
        updated_at: now
      })
      .execute();

    const mofs = await getUserMofs(userId);

    expect(mofs).toHaveLength(2);
    // First result should be the newer MOF
    expect(mofs[0].serial_number).toBe('MOF-NEW');
    expect(mofs[1].serial_number).toBe('MOF-OLD');
    
    // Verify ordering by checking timestamps
    expect(mofs[0].created_at >= mofs[1].created_at).toBe(true);
  });

  it('should return empty array for non-existent user', async () => {
    const result = await getUserMofs(99999); // Non-existent user ID
    
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle user with mixed MOF statuses', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create MOFs with different statuses
    await db.insert(mofsTable)
      .values([
        {
          ...testMof1,
          created_by: userId,
          serial_number: 'MOF-PENDING',
          status: 'Pending'
        },
        {
          ...testMof2,
          created_by: userId,
          serial_number: 'MOF-PROGRESS',
          status: 'In Progress'
        }
      ])
      .execute();

    const mofs = await getUserMofs(userId);

    expect(mofs).toHaveLength(2);
    
    // Check that all statuses are preserved
    const statuses = mofs.map(mof => mof.status).sort();
    expect(statuses).toEqual(['In Progress', 'Pending']);
    
    // Verify all MOFs belong to the user
    expect(mofs.every(mof => mof.created_by === userId)).toBe(true);
  });

  it('should verify database consistency after fetching MOFs', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create a MOF
    await db.insert(mofsTable)
      .values({
        ...testMof1,
        created_by: userId,
        serial_number: 'MOF-VERIFY'
      })
      .execute();

    const result = await getUserMofs(userId);
    expect(result).toHaveLength(1);

    // Verify the MOF exists in database with correct data
    const dbMofs = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.created_by, userId))
      .execute();

    expect(dbMofs).toHaveLength(1);
    expect(dbMofs[0].serial_number).toBe('MOF-VERIFY');
    expect(dbMofs[0].created_by).toBe(userId);
    
    // Compare handler result with direct database query
    expect(result[0].id).toBe(dbMofs[0].id);
    expect(result[0].serial_number).toBe(dbMofs[0].serial_number);
    expect(result[0].part_number).toBe(dbMofs[0].part_number);
  });
});