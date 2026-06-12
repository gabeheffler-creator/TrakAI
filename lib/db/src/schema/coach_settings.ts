import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const coachSettingsTable = pgTable("coach_settings", {
  id: serial("id").primaryKey(),
  settingsJson: text("settings_json").notNull().default("{}"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoachSettings = typeof coachSettingsTable.$inferSelect;
