import { z } from 'zod';

// Enum definitions
export const userRoleSchema = z.enum(['Admin', 'Picking', 'Requester']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const mofStatusSchema = z.enum([
  'Pending', 
  'In Progress', 
  'MOF siap Supply', 
  'Completed'
]);
export type MofStatus = z.infer<typeof mofStatusSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  full_name: z.string(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Material Outgoing Form (MOF) schema
export const mofSchema = z.object({
  id: z.number(),
  serial_number: z.string(),
  part_number: z.string(),
  quantity_requested: z.number().int().positive(),
  expected_receiving_date: z.coerce.date(),
  requester_name: z.string(),
  department: z.string(),
  project: z.string(),
  status: mofStatusSchema,
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Mof = z.infer<typeof mofSchema>;

// Item schema
export const itemSchema = z.object({
  id: z.number(),
  part_number: z.string(),
  supplier: z.string(),
  serial_number: z.string(),
  is_scanned_by_picker: z.boolean(),
  is_scanned_by_requester: z.boolean(),
  mof_id: z.number().nullable(),
  picked_at: z.coerce.date().nullable(),
  verified_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Item = z.infer<typeof itemSchema>;

// Pick record schema (tracks individual item picks)
export const pickRecordSchema = z.object({
  id: z.number(),
  mof_id: z.number(),
  item_id: z.number(),
  picked_by: z.number(),
  picked_at: z.coerce.date(),
  created_at: z.coerce.date()
});

export type PickRecord = z.infer<typeof pickRecordSchema>;

// Verification record schema (tracks requester verifications)
export const verificationRecordSchema = z.object({
  id: z.number(),
  mof_id: z.number(),
  item_id: z.number(),
  verified_by: z.number(),
  verified_at: z.coerce.date(),
  created_at: z.coerce.date()
});

export type VerificationRecord = z.infer<typeof verificationRecordSchema>;

// Input schemas for creating/updating entities

// Create MOF input
export const createMofInputSchema = z.object({
  part_number: z.string(),
  quantity_requested: z.number().int().positive(),
  expected_receiving_date: z.coerce.date(),
  requester_name: z.string(),
  department: z.string(),
  project: z.string(),
  created_by: z.number()
});

export type CreateMofInput = z.infer<typeof createMofInputSchema>;

// Create user input
export const createUserInputSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Create item input
export const createItemInputSchema = z.object({
  part_number: z.string(),
  supplier: z.string(),
  serial_number: z.string()
});

export type CreateItemInput = z.infer<typeof createItemInputSchema>;

// Scan item input (for picker flow)
export const scanItemInputSchema = z.object({
  mof_serial_number: z.string(),
  item_serial_number: z.string(),
  picked_by: z.number()
});

export type ScanItemInput = z.infer<typeof scanItemInputSchema>;

// Verify item input (for requester verification flow)
export const verifyItemInputSchema = z.object({
  mof_serial_number: z.string(),
  item_serial_number: z.string(),
  verified_by: z.number()
});

export type VerifyItemInput = z.infer<typeof verifyItemInputSchema>;

// Update MOF status input
export const updateMofStatusInputSchema = z.object({
  id: z.number(),
  status: mofStatusSchema
});

export type UpdateMofStatusInput = z.infer<typeof updateMofStatusInputSchema>;

// Get MOF by serial number input
export const getMofBySerialInputSchema = z.object({
  serial_number: z.string()
});

export type GetMofBySerialInput = z.infer<typeof getMofBySerialInputSchema>;

// Get MOF progress input
export const getMofProgressInputSchema = z.object({
  mof_id: z.number()
});

export type GetMofProgressInput = z.infer<typeof getMofProgressInputSchema>;

// MOF progress response schema
export const mofProgressSchema = z.object({
  mof: mofSchema,
  quantity_requested: z.number().int(),
  quantity_picked: z.number().int(),
  quantity_verified: z.number().int(),
  items_picked: z.array(itemSchema),
  items_verified: z.array(itemSchema)
});

export type MofProgress = z.infer<typeof mofProgressSchema>;