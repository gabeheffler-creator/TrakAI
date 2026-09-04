import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { pool } from "@workspace/db";

const pepper = process.env.AUTH_TOKEN_PEPPER ?? (process.env.NODE_ENV === "production"
  ? (() => { throw new Error("AUTH_TOKEN_PEPPER must be set in production"); })()
  : "development-token-pepper-not-for-production");

const duration = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value * 1000 : fallback;
};
export const tokenHash = (token: string) => createHmac("sha256", pepper).update(token).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
const accessTtl = () => duration("AUTH_ACCESS_TOKEN_TTL_SECONDS", 15 * 60_000);
const refreshTtl = () => duration("AUTH_REFRESH_TOKEN_TTL_SECONDS", 30 * 24 * 60 * 60_000);
export const actionTtl = (purpose: string) => duration(
  `AUTH_${purpose.toUpperCase()}_TTL_SECONDS`,
  purpose === "password_reset" ? 60 * 60_000 : purpose === "email_verification" ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000,
);

export function safeEqualHash(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function parseRefreshToken(refreshToken: string): { sessionId: string; secret: string } | null {
  const [sessionId, secret, ...extra] = refreshToken.split(".");
  return sessionId && secret && extra.length === 0 ? { sessionId, secret } : null;
}

export async function issueNativeTokens(actorType: "coach" | "client", actorId: number, metadata: { deviceLabel?: string; userAgent?: string; ip?: string }) {
  const id = randomUUID(), accessToken = secret(), refreshSecret = secret();
  const now = Date.now(), accessExpiresAt = new Date(now + accessTtl()), refreshExpiresAt = new Date(now + refreshTtl());
  await pool.query(
    `insert into auth_sessions (id, actor_type, actor_id, kind, device_label, access_token_hash, access_expires_at, refresh_token_hash, refresh_expires_at, expires_at, user_agent, ip)
     values ($1,$2,$3,'native',$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, actorType, actorId, metadata.deviceLabel ?? null, tokenHash(accessToken), accessExpiresAt, tokenHash(refreshSecret), refreshExpiresAt, refreshExpiresAt, metadata.userAgent ?? null, metadata.ip ?? null],
  );
  return { accessToken, refreshToken: `${id}.${refreshSecret}`, accessExpiresAt, refreshExpiresAt, sessionId: id };
}

export async function rotateNativeTokens(refreshToken: string) {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return null;
  const { sessionId: id, secret: value } = parsed;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const found = await client.query(`select * from auth_sessions where id = $1 for update`, [id]);
    const session = found.rows[0];
    const invalid = !session || session.kind !== "native" || session.revoked_at ||
      new Date(session.refresh_expires_at).getTime() <= Date.now() ||
      !safeEqualHash(session.refresh_token_hash ?? "", tokenHash(value));
    if (invalid) {
      if (session) await client.query("update auth_sessions set revoked_at = coalesce(revoked_at, now()) where id=$1", [id]);
      await client.query("commit"); return null;
    }
    const accessToken = secret(), nextRefresh = secret();
    const accessExpiresAt = new Date(Date.now() + accessTtl()), refreshExpiresAt = new Date(Date.now() + refreshTtl());
    await client.query(
      `update auth_sessions set access_token_hash=$2, access_expires_at=$3, refresh_token_hash=$4, refresh_expires_at=$5, expires_at=$5, last_used_at=now() where id=$1`,
      [id, tokenHash(accessToken), accessExpiresAt, tokenHash(nextRefresh), refreshExpiresAt],
    );
    await client.query("commit");
    return { accessToken, refreshToken: `${id}.${nextRefresh}`, accessExpiresAt, refreshExpiresAt, sessionId: id, actorType: session.actor_type, actorId: session.actor_id };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function issueActionToken(actorType: "coach" | "client", actorId: number, purpose: "password_reset" | "email_verification" | "invite_accept") {
  const token = secret(), expiresAt = new Date(Date.now() + actionTtl(purpose));
  await pool.query("insert into auth_action_tokens (token_hash, actor_type, actor_id, purpose, expires_at) values ($1,$2,$3,$4,$5)", [tokenHash(token), actorType, actorId, purpose, expiresAt]);
  return { token, expiresAt };
}

export async function consumeActionToken(token: string, purpose: string) {
  const result = await pool.query(
    `update auth_action_tokens set used_at=now() where token_hash=$1 and purpose=$2 and used_at is null and expires_at > now()
     returning actor_type, actor_id`, [tokenHash(token), purpose],
  );
  return result.rows[0] as { actor_type: "coach" | "client"; actor_id: number } | undefined;
}

/** Locks and validates a native refresh credential before a caller revokes it. */
export async function revokeNativeRefreshToken(refreshToken: string, deviceToken?: string): Promise<boolean> {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return false;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query("select refresh_token_hash, refresh_expires_at, revoked_at, kind, actor_type, actor_id from auth_sessions where id=$1 for update", [parsed.sessionId]);
    const row = result.rows[0];
    const valid = row?.kind === "native" && !row.revoked_at && new Date(row.refresh_expires_at).getTime() > Date.now() &&
      safeEqualHash(row.refresh_token_hash ?? "", tokenHash(parsed.secret));
    if (valid) {
      await client.query("update auth_sessions set revoked_at=now() where id=$1", [parsed.sessionId]);
      if (deviceToken) {
        await client.query(
          "delete from native_push_tokens where device_token=$1 and actor_type=$2 and actor_id=$3",
          [deviceToken, row.actor_type, row.actor_id],
        );
      }
    }
    await client.query("commit");
    return valid;
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}