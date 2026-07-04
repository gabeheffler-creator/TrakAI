import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coachesTable } from "./coaches";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coachesTable.id, { onDelete: "cascade" }),
  clerkUserId: text("clerk_user_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  goal: text("goal"),
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
