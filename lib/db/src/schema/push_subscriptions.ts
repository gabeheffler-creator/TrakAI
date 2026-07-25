import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  role: text("role").notNull(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  // Composite unique: one row per (endpoint, clientId) pair so a coach can
  // receive notifications for each of their clients independently.
  unique("push_subscriptions_endpoint_client_id_unique").on(t.endpoint, t.clientId),
]);

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptionsTable.$inferInsert;
