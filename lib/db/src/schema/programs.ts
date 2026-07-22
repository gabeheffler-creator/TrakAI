import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { exercisesTable } from "./exercises";
import { coachesTable } from "./coaches";
import { clientsTable } from "./clients";

export const programsTable = pgTable("programs", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coachesTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  sourceTemplateId: integer("source_template_id").references((): any => programsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  durationWeeks: integer("duration_weeks"),
  sleepAdjustEnabled: boolean("sleep_adjust_enabled").notNull().default(true),
  sleepAdjustPercent: integer("sleep_adjust_percent").notNull().default(20),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const programPhasesTable = pgTable("program_phases", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  durationWeeks: integer("duration_weeks").notNull().default(4),
  daysPerWeek: integer("days_per_week"),
});

export const programDaysTable = pgTable("program_days", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").notNull().references(() => programsTable.id, { onDelete: "cascade" }),
  phaseId: integer("phase_id").references(() => programPhasesTable.id, { onDelete: "set null" }),
  dayNumber: integer("day_number").notNull(),
  name: text("name").notNull(),
  notes: text("notes"),
});

export const programExercisesTable = pgTable("program_exercises", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id").notNull().references(() => programDaysTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercisesTable.id),
  sets: integer("sets").notNull(),
  reps: text("reps").notNull(),
  order: integer("order").notNull().default(0),
  weight: text("weight"),
  notes: text("notes"),
  restSeconds: integer("rest_seconds"),
});

export const programNutritionGoalsTable = pgTable("program_nutrition_goals", {
  id: serial("id").primaryKey(),
  phaseId: integer("phase_id").notNull().references(() => programPhasesTable.id, { onDelete: "cascade" }),
  dayId: integer("day_id").references(() => programDaysTable.id, { onDelete: "cascade" }),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const programAssignmentsTable = pgTable("program_assignments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().unique(),
  programId: integer("program_id").notNull().references(() => programsTable.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const programAssignmentHistoryTable = pgTable("program_assignment_history", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  programId: integer("program_id"),
  programName: text("program_name").notNull(),
  sourceTemplateId: integer("source_template_id"),
  sourceTemplateName: text("source_template_name"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProgramSchema = createInsertSchema(programsTable).omit({ id: true, createdAt: true });
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type Program = typeof programsTable.$inferSelect;
export type ProgramPhase = typeof programPhasesTable.$inferSelect;
export type ProgramDay = typeof programDaysTable.$inferSelect;
export type ProgramExercise = typeof programExercisesTable.$inferSelect;
export type ProgramAssignment = typeof programAssignmentsTable.$inferSelect;
export type ProgramAssignmentHistory = typeof programAssignmentHistoryTable.$inferSelect;
export type ProgramNutritionGoal = typeof programNutritionGoalsTable.$inferSelect;
