import { db } from '../db';
import { mofsTable, itemsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { type GetMofProgressInput, type MofProgress } from '../schema';

export async function getMofProgress(input: GetMofProgressInput): Promise<MofProgress | null> {
  try {
    // Get the MOF details
    const mofs = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.id, input.mof_id))
      .execute();

    if (mofs.length === 0) {
      return null;
    }

    const mof = mofs[0];

    // Get all items associated with this MOF
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.mof_id, input.mof_id))
      .execute();

    // Filter items that have been picked and verified
    const itemsPicked = items.filter(item => item.is_scanned_by_picker);
    const itemsVerified = items.filter(item => item.is_scanned_by_requester);

    // Calculate quantities
    const quantityPicked = itemsPicked.length;
    const quantityVerified = itemsVerified.length;

    return {
      mof,
      quantity_requested: mof.quantity_requested,
      quantity_picked: quantityPicked,
      quantity_verified: quantityVerified,
      items_picked: itemsPicked,
      items_verified: itemsVerified
    };
  } catch (error) {
    console.error('Get MOF progress failed:', error);
    throw error;
  }
}