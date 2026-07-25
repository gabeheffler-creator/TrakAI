import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { exercisesTable } from "./exercises";
import { callLogsTable } from "./call_logs";

export const exerciseCuesTable = pgTable("exercise_cues", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercisesTable.id, { onDelete: "cascade" }),
  callLogId: integer("call_log_id").references(() => callLogsTable.id, { onDelete: "set null" }),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExerciseCue = typeof exerciseCuesTable.$inferSelect;
