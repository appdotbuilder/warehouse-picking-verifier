import { db } from '../db';
import { mofsTable } from '../db/schema';
import { type Mof } from '../schema';
import { desc } from 'drizzle-orm';

export const getAllMofs = async (): Promise<Mof[]> => {
  try {
    // Query all MOFs ordered by creation date (newest first)
    const results = await db.select()
      .from(mofsTable)
      .orderBy(desc(mofsTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch all MOFs:', error);
    throw error;
  }
};