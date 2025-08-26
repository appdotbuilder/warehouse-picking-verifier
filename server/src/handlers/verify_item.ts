import { db } from '../db';
import { mofsTable, itemsTable, verificationRecordsTable } from '../db/schema';
import { type VerifyItemInput, type Item } from '../schema';
import { eq, and, count } from 'drizzle-orm';

export async function verifyItem(input: VerifyItemInput): Promise<Item> {
  try {
    // 1. Find the MOF by serial number
    const mofResults = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.serial_number, input.mof_serial_number))
      .execute();

    if (mofResults.length === 0) {
      throw new Error(`MOF with serial number ${input.mof_serial_number} not found`);
    }

    const mof = mofResults[0];

    // 2. Find the item by its serial number
    const itemResults = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.serial_number, input.item_serial_number))
      .execute();

    if (itemResults.length === 0) {
      throw new Error(`Item with serial number ${input.item_serial_number} not found`);
    }

    const item = itemResults[0];

    // Verify the item belongs to the specified MOF
    if (item.mof_id !== mof.id) {
      throw new Error(`Item ${input.item_serial_number} does not belong to MOF ${input.mof_serial_number}`);
    }

    // 3. Ensure the item has already been picked
    if (!item.is_scanned_by_picker) {
      throw new Error(`Item ${input.item_serial_number} has not been picked yet`);
    }

    // Check if item is already verified
    if (item.is_scanned_by_requester) {
      throw new Error(`Item ${input.item_serial_number} has already been verified`);
    }

    // 4. Mark the item as verified by requester
    const verifiedAt = new Date();
    const updateResults = await db.update(itemsTable)
      .set({
        is_scanned_by_requester: true,
        verified_at: verifiedAt,
        updated_at: new Date()
      })
      .where(eq(itemsTable.id, item.id))
      .returning()
      .execute();

    const updatedItem = updateResults[0];

    // 5. Create a verification record
    await db.insert(verificationRecordsTable)
      .values({
        mof_id: mof.id,
        item_id: item.id,
        verified_by: input.verified_by,
        verified_at: verifiedAt
      })
      .execute();

    // 6. Check if all requested items are verified and update MOF status if needed
    const [verifiedItemsResult] = await db.select({
      verified: count()
    })
    .from(itemsTable)
    .where(and(
      eq(itemsTable.mof_id, mof.id),
      eq(itemsTable.is_scanned_by_requester, true)
    ))
    .execute();

    // If all requested items are verified, update MOF status to 'Completed'
    if (verifiedItemsResult.verified >= mof.quantity_requested) {
      await db.update(mofsTable)
        .set({
          status: 'Completed',
          updated_at: new Date()
        })
        .where(eq(mofsTable.id, mof.id))
        .execute();
    }

    // 7. Return the updated item
    return updatedItem;
  } catch (error) {
    console.error('Item verification failed:', error);
    throw error;
  }
}