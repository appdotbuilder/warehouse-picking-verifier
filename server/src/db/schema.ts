import { serial, text, pgTable, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum definitions
export const userRoleEnum = pgEnum('user_role', ['Admin', 'Picking', 'Requester']);
export const mofStatusEnum = pgEnum('mof_status', ['Pending', 'In Progress', 'MOF siap Supply', 'Completed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  full_name: text('full_name').notNull(),
  role: userRoleEnum('role').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Material Outgoing Forms table
export const mofsTable = pgTable('mofs', {
  id: serial('id').primaryKey(),
  serial_number: text('serial_number').notNull().unique(),
  part_number: text('part_number').notNull(),
  quantity_requested: integer('quantity_requested').notNull(),
  expected_receiving_date: timestamp('expected_receiving_date').notNull(),
  requester_name: text('requester_name').notNull(),
  department: text('department').notNull(),
  project: text('project').notNull(),
  status: mofStatusEnum('status').notNull().default('Pending'),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Items table
export const itemsTable = pgTable('items', {
  id: serial('id').primaryKey(),
  part_number: text('part_number').notNull(),
  supplier: text('supplier').notNull(),
  serial_number: text('serial_number').notNull().unique(),
  is_scanned_by_picker: boolean('is_scanned_by_picker').notNull().default(false),
  is_scanned_by_requester: boolean('is_scanned_by_requester').notNull().default(false),
  mof_id: integer('mof_id').references(() => mofsTable.id),
  picked_at: timestamp('picked_at'),
  verified_at: timestamp('verified_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Pick records table (tracks individual item picks)
export const pickRecordsTable = pgTable('pick_records', {
  id: serial('id').primaryKey(),
  mof_id: integer('mof_id').notNull().references(() => mofsTable.id),
  item_id: integer('item_id').notNull().references(() => itemsTable.id),
  picked_by: integer('picked_by').notNull().references(() => usersTable.id),
  picked_at: timestamp('picked_at').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Verification records table (tracks requester verifications)
export const verificationRecordsTable = pgTable('verification_records', {
  id: serial('id').primaryKey(),
  mof_id: integer('mof_id').notNull().references(() => mofsTable.id),
  item_id: integer('item_id').notNull().references(() => itemsTable.id),
  verified_by: integer('verified_by').notNull().references(() => usersTable.id),
  verified_at: timestamp('verified_at').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdMofs: many(mofsTable),
  pickRecords: many(pickRecordsTable),
  verificationRecords: many(verificationRecordsTable)
}));

export const mofsRelations = relations(mofsTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [mofsTable.created_by],
    references: [usersTable.id]
  }),
  items: many(itemsTable),
  pickRecords: many(pickRecordsTable),
  verificationRecords: many(verificationRecordsTable)
}));

export const itemsRelations = relations(itemsTable, ({ one, many }) => ({
  mof: one(mofsTable, {
    fields: [itemsTable.mof_id],
    references: [mofsTable.id]
  }),
  pickRecords: many(pickRecordsTable),
  verificationRecords: many(verificationRecordsTable)
}));

export const pickRecordsRelations = relations(pickRecordsTable, ({ one }) => ({
  mof: one(mofsTable, {
    fields: [pickRecordsTable.mof_id],
    references: [mofsTable.id]
  }),
  item: one(itemsTable, {
    fields: [pickRecordsTable.item_id],
    references: [itemsTable.id]
  }),
  picker: one(usersTable, {
    fields: [pickRecordsTable.picked_by],
    references: [usersTable.id]
  })
}));

export const verificationRecordsRelations = relations(verificationRecordsTable, ({ one }) => ({
  mof: one(mofsTable, {
    fields: [verificationRecordsTable.mof_id],
    references: [mofsTable.id]
  }),
  item: one(itemsTable, {
    fields: [verificationRecordsTable.item_id],
    references: [itemsTable.id]
  }),
  verifier: one(usersTable, {
    fields: [verificationRecordsTable.verified_by],
    references: [usersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Mof = typeof mofsTable.$inferSelect;
export type NewMof = typeof mofsTable.$inferInsert;

export type Item = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;

export type PickRecord = typeof pickRecordsTable.$inferSelect;
export type NewPickRecord = typeof pickRecordsTable.$inferInsert;

export type VerificationRecord = typeof verificationRecordsTable.$inferSelect;
export type NewVerificationRecord = typeof verificationRecordsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  mofs: mofsTable,
  items: itemsTable,
  pickRecords: pickRecordsTable,
  verificationRecords: verificationRecordsTable
};