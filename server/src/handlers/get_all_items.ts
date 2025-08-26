import { db } from '../db';
import { itemsTable } from '../db/schema';
import { type Item } from '../schema';

export async function getAllItems(): Promise<Item[]> {
  try {
    // Fetch all items from the database
    const results = await db.select()
      .from(itemsTable)
      .execute();

    // Convert the results to match the schema format
    return results.map(item => ({
      id: item.id,
      part_number: item.part_number,
      supplier: item.supplier,
      serial_number: item.serial_number,
      is_scanned_by_picker: item.is_scanned_by_picker,
      is_scanned_by_requester: item.is_scanned_by_requester,
      mof_id: item.mof_id,
      picked_at: item.picked_at,
      verified_at: item.verified_at,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
  } catch (error) {
    console.error('Failed to get all items:', error);
    throw error;
  }
}