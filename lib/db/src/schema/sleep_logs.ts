import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const sleepLogsTable = pgTable("sleep_logs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  hoursSlept: numeric("hours_slept").notNull(),
  quality: text("quality"),
  energyRating: integer("energy_rating"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSleepLogSchema = createInsertSchema(sleepLogsTable).omit({ id: true, createdAt: true });
export type InsertSleepLog = z.infer<typeof insertSleepLogSchema>;
export type SleepLog = typeof sleepLogsTable.$inferSelect;
