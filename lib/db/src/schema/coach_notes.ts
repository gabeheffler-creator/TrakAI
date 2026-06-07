import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const coachNotesTable = pgTable("coach_notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoachNote = typeof coachNotesTable.$inferSelect;
