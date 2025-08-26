import { db } from '../db';
import { mofsTable } from '../db/schema';
import { type GetMofBySerialInput, type Mof } from '../schema';
import { eq } from 'drizzle-orm';

export async function getMofBySerial(input: GetMofBySerialInput): Promise<Mof | null> {
  try {
    // Query the MOF by serial number
    const results = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.serial_number, input.serial_number))
      .execute();

    // Return the first result or null if not found
    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error('Failed to get MOF by serial:', error);
    throw error;
  }
}