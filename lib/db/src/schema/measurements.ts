import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const measurementsTable = pgTable("measurements", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  weight: numeric("weight"),
  chest: numeric("chest"),
  waist: numeric("waist"),
  hips: numeric("hips"),
  arms: numeric("arms"),
  thighs: numeric("thighs"),
  calves: numeric("calves"),
  unit: text("unit").notNull().default("imperial"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMeasurementSchema = createInsertSchema(measurementsTable).omit({ id: true, createdAt: true });
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurementsTable.$inferSelect;
