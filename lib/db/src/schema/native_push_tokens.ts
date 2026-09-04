import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * APNs device tokens are intentionally kept separate from browser Web Push
 * subscriptions: they have different credentials, delivery semantics, and
 * ownership is always an authenticated application actor.
 */
export const nativePushTokensTable = pgTable("native_push_tokens", {
  id: serial("id").primaryKey(),
  deviceToken: text("device_token").notNull(),
  actorType: text("actor_type").notNull(),
  actorId: integer("actor_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, table => [
  uniqueIndex("native_push_tokens_device_token_idx").on(table.deviceToken),
  index("native_push_tokens_actor_idx").on(table.actorType, table.actorId),
]);

export const insertNativePushTokenSchema = createInsertSchema(nativePushTokensTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNativePushToken = z.infer<typeof insertNativePushTokenSchema>;
export type NativePushToken = typeof nativePushTokensTable.$inferSelect;