import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;
