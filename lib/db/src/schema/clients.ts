import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coachesTable } from "./coaches";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coachesTable.id, { onDelete: "cascade" }),
  clerkUserId: text("clerk_user_id").unique(),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  goal: text("goal"),
  goalTargetDate: text("goal_target_date"),
  notes: text("notes"),
  inviteToken: text("invite_token"),
  inviteTokenUsed: boolean("invite_token_used").notNull().default(false),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

export const clientGoalHistoryTable = pgTable("client_goal_history", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  goalTargetDate: text("goal_target_date"),
  archivedAt: timestamp("archived_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClientGoalHistory = typeof clientGoalHistoryTable.$inferSelect;
