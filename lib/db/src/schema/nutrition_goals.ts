import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const nutritionGoalsTable = pgTable("nutrition_goals", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  waterOz: integer("water_oz"),
  periodType: text("period_type").notNull().default("day"),
  effectiveWeek: integer("effective_week"),
  durationWeeks: integer("duration_weeks"),
  notes: text("notes"),
  dayType: text("day_type").notNull().default("any"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NutritionGoal = typeof nutritionGoalsTable.$inferSelect;
