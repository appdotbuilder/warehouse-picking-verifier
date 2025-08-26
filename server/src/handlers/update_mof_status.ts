import { db } from '../db';
import { mofsTable } from '../db/schema';
import { type UpdateMofStatusInput, type Mof } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateMofStatus(input: UpdateMofStatusInput): Promise<Mof> {
  try {
    // Update the MOF status and updated_at timestamp
    const result = await db
      .update(mofsTable)
      .set({
        status: input.status,
        updated_at: new Date()
      })
      .where(eq(mofsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`MOF with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('MOF status update failed:', error);
    throw error;
  }
}