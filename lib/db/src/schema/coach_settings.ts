import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { coachesTable } from "./coaches";

export const coachSettingsTable = pgTable("coach_settings", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").notNull().unique().references(() => coachesTable.id, { onDelete: "cascade" }),
  settingsJson: text("settings_json").notNull().default("{}"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoachSettings = typeof coachSettingsTable.$inferSelect;
