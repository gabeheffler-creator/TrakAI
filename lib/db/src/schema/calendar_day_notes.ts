import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const calendarDayNotesTable = pgTable("calendar_day_notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CalendarDayNote = typeof calendarDayNotesTable.$inferSelect;
