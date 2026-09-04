import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Metadata-only audit trail for AI provider attempts. Prompts, images, and
 * provider responses deliberately do not belong in this table.
 */
export const aiUsageTable = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  callerType: text("caller_type").notNull(),
  callerId: integer("caller_id").notNull(),
  feature: text("feature").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  outcome: text("outcome").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  durationMs: integer("duration_ms"),
  errorCategory: text("error_category"),
}, (table) => [
  index("ai_usage_caller_occurred_at_idx").on(table.callerType, table.callerId, table.occurredAt),
]);

export type AiUsage = typeof aiUsageTable.$inferSelect;