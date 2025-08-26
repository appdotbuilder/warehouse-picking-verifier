import { db } from '../db';
import { itemsTable } from '../db/schema';
import { type CreateItemInput, type Item } from '../schema';

export const createItem = async (input: CreateItemInput): Promise<Item> => {
  try {
    // Insert item record
    const result = await db.insert(itemsTable)
      .values({
        part_number: input.part_number,
        supplier: input.supplier,
        serial_number: input.serial_number,
        is_scanned_by_picker: false,
        is_scanned_by_requester: false,
        mof_id: null,
        picked_at: null,
        verified_at: null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Item creation failed:', error);
    throw error;
  }
};