import { db } from '../db';
import { mofsTable, itemsTable, pickRecordsTable } from '../db/schema';
import { type ScanItemInput, type Item } from '../schema';
import { eq, and, count } from 'drizzle-orm';

export async function scanItem(input: ScanItemInput): Promise<Item> {
  try {
    // 1. Find the MOF by serial number
    const mofs = await db.select()
      .from(mofsTable)
      .where(eq(mofsTable.serial_number, input.mof_serial_number))
      .execute();

    if (mofs.length === 0) {
      throw new Error(`MOF with serial number ${input.mof_serial_number} not found`);
    }

    const mof = mofs[0];

    // 2. Find the item by its serial number
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.serial_number, input.item_serial_number))
      .execute();

    if (items.length === 0) {
      throw new Error(`Item with serial number ${input.item_serial_number} not found`);
    }

    const item = items[0];

    // 3. Validate the item's part number matches the MOF's part number
    if (item.part_number !== mof.part_number) {
      throw new Error(`Item part number ${item.part_number} does not match MOF part number ${mof.part_number}`);
    }

    // Check if item is already scanned by picker
    if (item.is_scanned_by_picker) {
      throw new Error(`Item with serial number ${input.item_serial_number} has already been scanned by picker`);
    }

    // 4. Mark the item as scanned by picker and assign to MOF
    const now = new Date();
    const updatedItems = await db.update(itemsTable)
      .set({
        is_scanned_by_picker: true,
        mof_id: mof.id,
        picked_at: now,
        updated_at: now
      })
      .where(eq(itemsTable.id, item.id))
      .returning()
      .execute();

    const updatedItem = updatedItems[0];

    // 5. Create a pick record
    await db.insert(pickRecordsTable)
      .values({
        mof_id: mof.id,
        item_id: item.id,
        picked_by: input.picked_by,
        picked_at: now
      })
      .execute();

    // 6. Update MOF status if all items are picked
    // Count how many items have been picked for this MOF
    const pickedCountResult = await db.select({ count: count() })
      .from(itemsTable)
      .where(and(
        eq(itemsTable.mof_id, mof.id),
        eq(itemsTable.is_scanned_by_picker, true)
      ))
      .execute();

    const pickedCount = pickedCountResult[0].count;

    // If all requested items are picked, update MOF status
    if (pickedCount === mof.quantity_requested) {
      await db.update(mofsTable)
        .set({
          status: 'MOF siap Supply',
          updated_at: now
        })
        .where(eq(mofsTable.id, mof.id))
        .execute();
    } else if (mof.status === 'Pending') {
      // If this is the first pick, update status to In Progress
      await db.update(mofsTable)
        .set({
          status: 'In Progress',
          updated_at: now
        })
        .where(eq(mofsTable.id, mof.id))
        .execute();
    }

    // 7. Return the updated item
    return updatedItem;

  } catch (error) {
    console.error('Item scan failed:', error);
    throw error;
  }
}