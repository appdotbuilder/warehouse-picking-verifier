import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, mofsTable } from '../db/schema';
import { type UpdateMofStatusInput } from '../schema';
import { updateMofStatus } from '../handlers/update_mof_status';
import { eq } from 'drizzle-orm';

describe('updateMofStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update MOF status successfully', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'Admin'
      })
      .returning()
      .execute();

    // Create test MOF
    const mofResult = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-001',
        part_number: 'PART-001',
        quantity_requested: 10,
        expected_receiving_date: new Date('2024-12-31'),
        requester_name: 'John Doe',
        department: 'Engineering',
        project: 'Test Project',
        status: 'Pending',
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const testInput: UpdateMofStatusInput = {
      id: mofResult[0].id,
      status: 'In Progress'
    };

    const result = await updateMofStatus(testInput);

    // Verify the returned MOF has updated status
    expect(result.id).toEqual(mofResult[0].id);
    expect(result.status).toEqual('In Progress');
    expect(result.serial_number).toEqual('MOF-001');
    expect(result.part_number).toEqual('PART-001');
    expect(result.quantity_requested).toEqual(10);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Verify updated_at is more recent than created_at
    expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
  });

  it('should save updated status to database', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser2',
        email: 'test2@example.com',
        full_name: 'Test User 2',
        role: 'Picking'
      })
      .returning()
      .execute();

    // Create test MOF
    const mofResult = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-002',
        part_number: 'PART-002',
        quantity_requested: 5,
        expected_receiving_date: new Date('2024-12-25'),
        requester_name: 'Jane Smith',
        department: 'Manufacturing',
        project: 'Production Line',
        status: 'In Progress',
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const testInput: UpdateMofStatusInput = {
      id: mofResult[0].id,
      status: 'MOF siap Supply'
    };

    await updateMofStatus(testInput);

    // Query database directly to verify the update
    const updatedMofs = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, mofResult[0].id))
      .execute();

    expect(updatedMofs).toHaveLength(1);
    expect(updatedMofs[0].status).toEqual('MOF siap Supply');
    expect(updatedMofs[0].updated_at).toBeInstanceOf(Date);
    expect(updatedMofs[0].updated_at.getTime()).toBeGreaterThan(updatedMofs[0].created_at.getTime());
  });

  it('should handle all valid status transitions', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'statususer',
        email: 'status@example.com',
        full_name: 'Status User',
        role: 'Admin'
      })
      .returning()
      .execute();

    // Create test MOF
    const mofResult = await db.insert(mofsTable)
      .values({
        serial_number: 'MOF-STATUS',
        part_number: 'PART-STATUS',
        quantity_requested: 1,
        expected_receiving_date: new Date('2024-12-31'),
        requester_name: 'Status Test',
        department: 'QA',
        project: 'Status Testing',
        status: 'Pending',
        created_by: userResult[0].id
      })
      .returning()
      .execute();

    const statuses = ['In Progress', 'MOF siap Supply', 'Completed'] as const;

    for (const status of statuses) {
      const testInput: UpdateMofStatusInput = {
        id: mofResult[0].id,
        status: status
      };

      const result = await updateMofStatus(testInput);
      expect(result.status).toEqual(status);
    }
  });

  it('should throw error when MOF does not exist', async () => {
    const testInput: UpdateMofStatusInput = {
      id: 99999, // Non-existent ID
      status: 'Completed'
    };

    await expect(updateMofStatus(testInput)).rejects.toThrow(/MOF with id 99999 not found/i);
  });

  it('should preserve all other MOF fields when updating status', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'preserveuser',
        email: 'preserve@example.com',
        full_name: 'Preserve User',
        role: 'Requester'
      })
      .returning()
      .execute();

    // Create test MOF with specific values to preserve
    const originalMof = {
      serial_number: 'MOF-PRESERVE',
      part_number: 'PART-PRESERVE',
      quantity_requested: 42,
      expected_receiving_date: new Date('2025-01-15'),
      requester_name: 'Preserve Requester',
      department: 'Research',
      project: 'Preservation Project',
      status: 'Pending' as const,
      created_by: userResult[0].id
    };

    const mofResult = await db.insert(mofsTable)
      .values(originalMof)
      .returning()
      .execute();

    const testInput: UpdateMofStatusInput = {
      id: mofResult[0].id,
      status: 'Completed'
    };

    const result = await updateMofStatus(testInput);

    // Verify all fields are preserved except status and updated_at
    expect(result.serial_number).toEqual(originalMof.serial_number);
    expect(result.part_number).toEqual(originalMof.part_number);
    expect(result.quantity_requested).toEqual(originalMof.quantity_requested);
    expect(result.expected_receiving_date).toEqual(originalMof.expected_receiving_date);
    expect(result.requester_name).toEqual(originalMof.requester_name);
    expect(result.department).toEqual(originalMof.department);
    expect(result.project).toEqual(originalMof.project);
    expect(result.created_by).toEqual(originalMof.created_by);
    expect(result.created_at).toEqual(mofResult[0].created_at);
    
    // Only status and updated_at should change
    expect(result.status).toEqual('Completed');
    expect(result.updated_at.getTime()).toBeGreaterThan(mofResult[0].updated_at.getTime());
  });
});