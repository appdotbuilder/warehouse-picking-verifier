import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { mofsTable, usersTable } from '../db/schema';
import { type CreateMofInput } from '../schema';
import { createMof } from '../handlers/create_mof';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'test_admin',
  email: 'admin@test.com',
  full_name: 'Test Administrator',
  role: 'Admin' as const
};

// Test MOF input
const testMofInput: CreateMofInput = {
  part_number: 'PN-12345',
  quantity_requested: 50,
  expected_receiving_date: new Date('2024-12-31'),
  requester_name: 'John Doe',
  department: 'Engineering',
  project: 'Project Alpha',
  created_by: 1 // Will be set after user creation
};

describe('createMof', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a MOF with valid input', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const user = userResult[0];
    
    // Update input with actual user ID
    const input = { ...testMofInput, created_by: user.id };

    const result = await createMof(input);

    // Verify basic fields
    expect(result.part_number).toEqual('PN-12345');
    expect(result.quantity_requested).toEqual(50);
    expect(result.requester_name).toEqual('John Doe');
    expect(result.department).toEqual('Engineering');
    expect(result.project).toEqual('Project Alpha');
    expect(result.status).toEqual('Pending');
    expect(result.created_by).toEqual(user.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify serial number format
    expect(result.serial_number).toMatch(/^MOF-\d+-\d{3}$/);

    // Verify expected_receiving_date is preserved
    expect(result.expected_receiving_date).toEqual(new Date('2024-12-31'));
  });

  it('should save MOF to database', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const user = userResult[0];
    const input = { ...testMofInput, created_by: user.id };

    const result = await createMof(input);

    // Query database to verify MOF was saved
    const savedMofs = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, result.id))
      .execute();

    expect(savedMofs).toHaveLength(1);
    
    const savedMof = savedMofs[0];
    expect(savedMof.part_number).toEqual('PN-12345');
    expect(savedMof.quantity_requested).toEqual(50);
    expect(savedMof.requester_name).toEqual('John Doe');
    expect(savedMof.department).toEqual('Engineering');
    expect(savedMof.project).toEqual('Project Alpha');
    expect(savedMof.status).toEqual('Pending');
    expect(savedMof.created_by).toEqual(user.id);
    expect(savedMof.created_at).toBeInstanceOf(Date);
    expect(savedMof.updated_at).toBeInstanceOf(Date);
  });

  it('should generate unique serial numbers', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const user = userResult[0];
    const input = { ...testMofInput, created_by: user.id };

    // Create multiple MOFs
    const mof1 = await createMof(input);
    const mof2 = await createMof({ ...input, part_number: 'PN-67890' });
    const mof3 = await createMof({ ...input, part_number: 'PN-ABCDE' });

    // Verify all serial numbers are unique
    expect(mof1.serial_number).not.toEqual(mof2.serial_number);
    expect(mof1.serial_number).not.toEqual(mof3.serial_number);
    expect(mof2.serial_number).not.toEqual(mof3.serial_number);

    // Verify they all follow the expected format
    expect(mof1.serial_number).toMatch(/^MOF-\d+-\d{3}$/);
    expect(mof2.serial_number).toMatch(/^MOF-\d+-\d{3}$/);
    expect(mof3.serial_number).toMatch(/^MOF-\d+-\d{3}$/);
  });

  it('should reject MOF creation with non-existent user', async () => {
    const input = { ...testMofInput, created_by: 999 }; // Non-existent user ID

    await expect(createMof(input)).rejects.toThrow(/User with ID 999 not found/i);
  });

  it('should handle different user roles correctly', async () => {
    // Create users with different roles
    const adminUser = await db.insert(usersTable)
      .values({ ...testUser, username: 'admin1', email: 'admin1@test.com', role: 'Admin' })
      .returning()
      .execute();

    const pickerUser = await db.insert(usersTable)
      .values({ ...testUser, username: 'picker1', email: 'picker1@test.com', role: 'Picking' })
      .returning()
      .execute();

    const requesterUser = await db.insert(usersTable)
      .values({ ...testUser, username: 'requester1', email: 'requester1@test.com', role: 'Requester' })
      .returning()
      .execute();

    // All user roles should be able to create MOFs
    const adminMof = await createMof({ ...testMofInput, created_by: adminUser[0].id });
    const pickerMof = await createMof({ ...testMofInput, part_number: 'PN-PICKER', created_by: pickerUser[0].id });
    const requesterMof = await createMof({ ...testMofInput, part_number: 'PN-REQUESTER', created_by: requesterUser[0].id });

    expect(adminMof.created_by).toEqual(adminUser[0].id);
    expect(pickerMof.created_by).toEqual(pickerUser[0].id);
    expect(requesterMof.created_by).toEqual(requesterUser[0].id);
  });

  it('should handle various date formats correctly', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const user = userResult[0];

    // Test with different date formats
    const dateString = '2024-06-15';
    const dateObject = new Date('2024-12-25');
    
    const mof1 = await createMof({
      ...testMofInput,
      created_by: user.id,
      expected_receiving_date: new Date(dateString)
    });

    const mof2 = await createMof({
      ...testMofInput,
      part_number: 'PN-DATE-TEST',
      created_by: user.id,
      expected_receiving_date: dateObject
    });

    expect(mof1.expected_receiving_date).toEqual(new Date(dateString));
    expect(mof2.expected_receiving_date).toEqual(dateObject);
  });

  it('should preserve all input fields correctly', async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const user = userResult[0];

    const complexInput: CreateMofInput = {
      part_number: 'PN-COMPLEX-123-ABC',
      quantity_requested: 1500,
      expected_receiving_date: new Date('2025-03-15'),
      requester_name: 'Jane Smith-Johnson',
      department: 'Quality Assurance & Control',
      project: 'Project Beta - Phase 2',
      created_by: user.id
    };

    const result = await createMof(complexInput);

    expect(result.part_number).toEqual('PN-COMPLEX-123-ABC');
    expect(result.quantity_requested).toEqual(1500);
    expect(result.expected_receiving_date).toEqual(new Date('2025-03-15'));
    expect(result.requester_name).toEqual('Jane Smith-Johnson');
    expect(result.department).toEqual('Quality Assurance & Control');
    expect(result.project).toEqual('Project Beta - Phase 2');
    expect(result.created_by).toEqual(user.id);
    expect(result.status).toEqual('Pending');
  });
});