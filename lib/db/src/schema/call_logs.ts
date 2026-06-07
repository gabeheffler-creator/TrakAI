import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const callLogsTable = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CallLog = typeof callLogsTable.$inferSelect;
