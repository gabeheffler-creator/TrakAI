import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientTasksTable = pgTable("client_tasks", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  alternativeText: text("alternative_text"),
  altStatus: text("alt_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ClientTask = typeof clientTasksTable.$inferSelect;
export type InsertClientTask = typeof clientTasksTable.$inferInsert;
