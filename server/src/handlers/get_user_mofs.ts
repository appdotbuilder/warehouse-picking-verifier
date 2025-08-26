import { db } from '../db';
import { mofsTable } from '../db/schema';
import { type Mof } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getUserMofs = async (userId: number): Promise<Mof[]> => {
  try {
    // Query MOFs created by the specific user, ordered by most recent first
    const results = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.created_by, userId))
      .orderBy(desc(mofsTable.created_at))
      .execute();

    // Return the results as-is since MOF schema doesn't contain numeric columns that need conversion
    return results;
  } catch (error) {
    console.error('Failed to fetch user MOFs:', error);
    throw error;
  }
};