import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const EQUIPMENT_VALUES = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Bands", "Other"] as const;
export type Equipment = typeof EQUIPMENT_VALUES[number];

export const DIFFICULTY_VALUES = ["Beginner", "Intermediate", "Advanced"] as const;
export type Difficulty = typeof DIFFICULTY_VALUES[number];

export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group").notNull(),
  movementPattern: text("movement_pattern"),
  isCompound: boolean("is_compound").notNull().default(false),
  isUnilateral: boolean("is_unilateral").notNull().default(false),
  description: text("description"),
  videoUrl: text("video_url"),
  equipment: text("equipment").notNull().default("Other"),
  difficulty: text("difficulty").notNull().default("Intermediate"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({ id: true, createdAt: true });
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercisesTable.$inferSelect;
