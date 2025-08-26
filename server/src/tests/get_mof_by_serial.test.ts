import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, mofsTable } from '../db/schema';
import { type GetMofBySerialInput } from '../schema';
import { getMofBySerial } from '../handlers/get_mof_by_serial';

describe('getMofBySerial', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return MOF when serial number exists', async () => {
    // Create a test user first (required for foreign key)
    const [user] = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'Admin'
    }).returning().execute();

    // Create a test MOF
    const testDate = new Date('2024-01-15');
    const [mof] = await db.insert(mofsTable).values({
      serial_number: 'MOF-001',
      part_number: 'PART-123',
      quantity_requested: 5,
      expected_receiving_date: testDate,
      requester_name: 'John Doe',
      department: 'Engineering',
      project: 'Project Alpha',
      status: 'Pending',
      created_by: user.id
    }).returning().execute();

    // Test the handler
    const input: GetMofBySerialInput = {
      serial_number: 'MOF-001'
    };

    const result = await getMofBySerial(input);

    // Verify the result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(mof.id);
    expect(result!.serial_number).toEqual('MOF-001');
    expect(result!.part_number).toEqual('PART-123');
    expect(result!.quantity_requested).toEqual(5);
    expect(result!.requester_name).toEqual('John Doe');
    expect(result!.department).toEqual('Engineering');
    expect(result!.project).toEqual('Project Alpha');
    expect(result!.status).toEqual('Pending');
    expect(result!.created_by).toEqual(user.id);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.expected_receiving_date).toBeInstanceOf(Date);
  });

  it('should return null when serial number does not exist', async () => {
    const input: GetMofBySerialInput = {
      serial_number: 'NON-EXISTENT'
    };

    const result = await getMofBySerial(input);

    expect(result).toBeNull();
  });

  it('should return correct MOF when multiple MOFs exist', async () => {
    // Create a test user
    const [user] = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'Admin'
    }).returning().execute();

    // Create multiple test MOFs
    const testDate = new Date('2024-01-15');
    await db.insert(mofsTable).values([
      {
        serial_number: 'MOF-001',
        part_number: 'PART-123',
        quantity_requested: 5,
        expected_receiving_date: testDate,
        requester_name: 'John Doe',
        department: 'Engineering',
        project: 'Project Alpha',
        status: 'Pending',
        created_by: user.id
      },
      {
        serial_number: 'MOF-002',
        part_number: 'PART-456',
        quantity_requested: 10,
        expected_receiving_date: testDate,
        requester_name: 'Jane Smith',
        department: 'Manufacturing',
        project: 'Project Beta',
        status: 'In Progress',
        created_by: user.id
      }
    ]).execute();

    // Test retrieving the second MOF
    const input: GetMofBySerialInput = {
      serial_number: 'MOF-002'
    };

    const result = await getMofBySerial(input);

    // Verify we get the correct MOF
    expect(result).not.toBeNull();
    expect(result!.serial_number).toEqual('MOF-002');
    expect(result!.part_number).toEqual('PART-456');
    expect(result!.quantity_requested).toEqual(10);
    expect(result!.requester_name).toEqual('Jane Smith');
    expect(result!.department).toEqual('Manufacturing');
    expect(result!.project).toEqual('Project Beta');
    expect(result!.status).toEqual('In Progress');
  });

  it('should handle case-sensitive serial number matching', async () => {
    // Create a test user
    const [user] = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'Admin'
    }).returning().execute();

    // Create a test MOF with specific casing
    const testDate = new Date('2024-01-15');
    await db.insert(mofsTable).values({
      serial_number: 'mof-001',
      part_number: 'PART-123',
      quantity_requested: 5,
      expected_receiving_date: testDate,
      requester_name: 'John Doe',
      department: 'Engineering',
      project: 'Project Alpha',
      status: 'Pending',
      created_by: user.id
    }).execute();

    // Test with different casing
    const input: GetMofBySerialInput = {
      serial_number: 'MOF-001'
    };

    const result = await getMofBySerial(input);

    // Should return null because of case mismatch
    expect(result).toBeNull();
  });

  it('should return MOF with all status types', async () => {
    // Create a test user
    const [user] = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'Admin'
    }).returning().execute();

    const testDate = new Date('2024-01-15');

    // Test different status values
    const statuses = ['Pending', 'In Progress', 'MOF siap Supply', 'Completed'] as const;
    
    for (const status of statuses) {
      const serialNumber = `MOF-${status.replace(' ', '-')}`;
      
      await db.insert(mofsTable).values({
        serial_number: serialNumber,
        part_number: 'PART-123',
        quantity_requested: 5,
        expected_receiving_date: testDate,
        requester_name: 'John Doe',
        department: 'Engineering',
        project: 'Project Alpha',
        status: status,
        created_by: user.id
      }).execute();

      const input: GetMofBySerialInput = {
        serial_number: serialNumber
      };

      const result = await getMofBySerial(input);

      expect(result).not.toBeNull();
      expect(result!.status).toEqual(status);
      expect(result!.serial_number).toEqual(serialNumber);
    }
  });
});