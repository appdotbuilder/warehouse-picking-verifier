import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { itemsTable } from '../db/schema';
import { type CreateItemInput } from '../schema';
import { createItem } from '../handlers/create_item';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: CreateItemInput = {
  part_number: 'TEST-001',
  supplier: 'Test Supplier Co',
  serial_number: 'SN123456789'
};

const secondTestInput: CreateItemInput = {
  part_number: 'TEST-002',
  supplier: 'Another Supplier',
  serial_number: 'SN987654321'
};

describe('createItem', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an item with all required fields', async () => {
    const result = await createItem(testInput);

    // Verify all fields are correctly set
    expect(result.part_number).toEqual('TEST-001');
    expect(result.supplier).toEqual('Test Supplier Co');
    expect(result.serial_number).toEqual('SN123456789');
    expect(result.is_scanned_by_picker).toEqual(false);
    expect(result.is_scanned_by_requester).toEqual(false);
    expect(result.mof_id).toBeNull();
    expect(result.picked_at).toBeNull();
    expect(result.verified_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save item to database correctly', async () => {
    const result = await createItem(testInput);

    // Query database to verify item was saved
    const savedItems = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, result.id))
      .execute();

    expect(savedItems).toHaveLength(1);
    const savedItem = savedItems[0];

    expect(savedItem.part_number).toEqual('TEST-001');
    expect(savedItem.supplier).toEqual('Test Supplier Co');
    expect(savedItem.serial_number).toEqual('SN123456789');
    expect(savedItem.is_scanned_by_picker).toEqual(false);
    expect(savedItem.is_scanned_by_requester).toEqual(false);
    expect(savedItem.mof_id).toBeNull();
    expect(savedItem.picked_at).toBeNull();
    expect(savedItem.verified_at).toBeNull();
    expect(savedItem.created_at).toBeInstanceOf(Date);
    expect(savedItem.updated_at).toBeInstanceOf(Date);
  });

  it('should create multiple items with different serial numbers', async () => {
    const item1 = await createItem(testInput);
    const item2 = await createItem(secondTestInput);

    // Verify both items were created with different IDs
    expect(item1.id).not.toEqual(item2.id);
    expect(item1.serial_number).toEqual('SN123456789');
    expect(item2.serial_number).toEqual('SN987654321');

    // Verify both items exist in database
    const allItems = await db.select()
      .from(itemsTable)
      .execute();

    expect(allItems).toHaveLength(2);
    expect(allItems.map(item => item.serial_number)).toContain('SN123456789');
    expect(allItems.map(item => item.serial_number)).toContain('SN987654321');
  });

  it('should enforce unique serial number constraint', async () => {
    // Create first item
    await createItem(testInput);

    // Attempt to create second item with same serial number
    const duplicateInput: CreateItemInput = {
      part_number: 'DIFFERENT-001',
      supplier: 'Different Supplier',
      serial_number: 'SN123456789' // Same serial number
    };

    await expect(createItem(duplicateInput)).rejects.toThrow(/unique/i);
  });

  it('should handle various input data types correctly', async () => {
    const specialInput: CreateItemInput = {
      part_number: 'SPECIAL-CHARS-001!@#',
      supplier: 'Supplier with Spaces & Special Chars',
      serial_number: 'SN-WITH-DASHES-123'
    };

    const result = await createItem(specialInput);

    expect(result.part_number).toEqual('SPECIAL-CHARS-001!@#');
    expect(result.supplier).toEqual('Supplier with Spaces & Special Chars');
    expect(result.serial_number).toEqual('SN-WITH-DASHES-123');
  });

  it('should set default boolean values correctly', async () => {
    const result = await createItem(testInput);

    // Verify boolean defaults are set correctly
    expect(result.is_scanned_by_picker).toBe(false);
    expect(result.is_scanned_by_requester).toBe(false);
    expect(typeof result.is_scanned_by_picker).toBe('boolean');
    expect(typeof result.is_scanned_by_requester).toBe('boolean');
  });

  it('should set nullable fields to null by default', async () => {
    const result = await createItem(testInput);

    // Verify nullable fields are null by default
    expect(result.mof_id).toBeNull();
    expect(result.picked_at).toBeNull();
    expect(result.verified_at).toBeNull();
  });

  it('should auto-generate timestamps', async () => {
    const beforeCreate = new Date();
    const result = await createItem(testInput);
    const afterCreate = new Date();

    // Verify timestamps are within reasonable range
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000);
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000);
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);
  });
});