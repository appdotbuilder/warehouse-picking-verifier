import { db } from '../db';
import { mofsTable, usersTable } from '../db/schema';
import { type CreateMofInput, type Mof } from '../schema';
import { eq } from 'drizzle-orm';

export const createMof = async (input: CreateMofInput): Promise<Mof> => {
  try {
    // Verify that the creator (user) exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error(`User with ID ${input.created_by} not found`);
    }

    // Generate unique MOF serial number
    const serialNumber = `MOF-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    // Insert MOF record
    const result = await db.insert(mofsTable)
      .values({
        serial_number: serialNumber,
        part_number: input.part_number,
        quantity_requested: input.quantity_requested,
        expected_receiving_date: input.expected_receiving_date,
        requester_name: input.requester_name,
        department: input.department,
        project: input.project,
        status: 'Pending', // Default status
        created_by: input.created_by
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('MOF creation failed:', error);
    throw error;
  }
};