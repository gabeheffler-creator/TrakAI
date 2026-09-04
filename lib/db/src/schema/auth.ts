import { pgTable, text, integer, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";

/** Actor references are polymorphic, so application code enforces their target. */
export const authSessionsTable = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: text("actor_type", { enum: ["coach", "client"] }).notNull(),
  actorId: integer("actor_id").notNull(),
  kind: text("kind", { enum: ["cookie", "native"] }).notNull(),
  deviceLabel: text("device_label"),
  accessTokenHash: text("access_token_hash"),
  accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
  refreshTokenHash: text("refresh_token_hash"),
  refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userAgent: text("user_agent"),
  ip: text("ip"),
}, table => [index("auth_sessions_actor_idx").on(table.actorType, table.actorId)]);

export const authActionTokensTable = pgTable("auth_action_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  actorType: text("actor_type", { enum: ["coach", "client"] }).notNull(),
  actorId: integer("actor_id").notNull(),
  purpose: text("purpose", { enum: ["password_reset", "email_verification", "invite_accept"] }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("auth_action_tokens_actor_idx").on(table.actorType, table.actorId)]);

/** Server-side data for the signed express-session cookie. */
export const expressSessionsTable = pgTable("express_sessions", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull(),
}, table => [index("express_sessions_expire_idx").on(table.expire)]);