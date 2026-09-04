import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { db, coachesTable, clientsTable, pool } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { authBurstLimit } from "../lib/rate-limit";
import { issueActionToken, issueNativeTokens, rotateNativeTokens, revokeNativeRefreshToken, tokenHash } from "../lib/tokens";
import { resolveActor } from "../middlewares/auth";
import { sendGmail } from "../lib/mail";
import { authPageUrl } from "../lib/public-auth-urls";
import { TokenLoginBody, RefreshTokenBody, RequestPasswordResetBody, ConfirmPasswordResetBody, ConfirmEmailVerificationBody, RequestEmailVerificationBody } from "@workspace/api-zod";

const router = Router();
const metadata = (req: Request, deviceLabel?: string) => ({
  deviceLabel: (deviceLabel ?? req.get("x-device-label"))?.slice(0, 120),
  userAgent: req.get("user-agent")?.slice(0, 1000),
  ip: req.ip,
});
const regenerate = (req: Parameters<Router["post"]>[1] extends never ? never : any) => new Promise<void>((resolve, reject) => req.session.regenerate((error: unknown) => error ? reject(error) : resolve()));
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

async function cookieLogin(req: any, res: any, actorType: "coach" | "client", actor: { id: number; name: string }) {
  await regenerate(req);
  const result = await pool.query(
    `insert into auth_sessions (actor_type, actor_id, kind, device_label, expires_at, user_agent, ip)
     values ($1,$2,'cookie',$3,now() + interval '7 days',$4,$5) returning id`,
    [actorType, actor.id, req.get("x-device-label")?.slice(0, 120) ?? null, req.get("user-agent")?.slice(0, 1000) ?? null, req.ip],
  );
  req.session.authSessionId = result.rows[0].id;
  req.session.save((error: unknown) => error ? res.status(500).json({ error: "Login failed" }) : res.json({ ok: true, role: actorType, id: actor.id, name: actor.name }));
}
async function findCredentials(username: string, password: string, role?: "coach" | "client") {
  const coachLookup = db.select().from(coachesTable).where(or(eq(coachesTable.username, username), eq(coachesTable.email, username)));
  const clientLookup = db.select().from(clientsTable).where(or(eq(clientsTable.username, username), eq(clientsTable.email, username)));
  const candidates = role === "coach" ? [{ type: "coach" as const, row: (await coachLookup)[0] }]
    : role === "client" ? [{ type: "client" as const, row: (await clientLookup)[0] }]
    : [{ type: "coach" as const, row: (await coachLookup)[0] }, { type: "client" as const, row: (await clientLookup)[0] }];
  for (const candidate of candidates) if (candidate.row?.passwordHash && await bcrypt.compare(password, candidate.row.passwordHash)) return candidate;
  return null;
}
function login(role: "coach" | "client") {
  return async (req: any, res: any): Promise<void> => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) { res.status(400).json({ error: "username and password are required" }); return; }
    try {
      const result = await findCredentials(username, password, role);
      if (!result) { res.status(401).json({ error: "Invalid username or password" }); return; }
      if (result.row.emailVerificationRequired && !result.row.emailVerifiedAt) { res.status(403).json({ error: "Email verification required", code: "EMAIL_NOT_VERIFIED" }); return; }
      if (result.type === "client" && result.row.status === "inactive") { res.status(403).json({ error: "This account has been deactivated by your coach" }); return; }
      await cookieLogin(req, res, result.type, result.row);
    } catch (error) { req.log.error(error); res.status(500).json({ error: "Login failed" }); }
  };
}
router.post("/auth/coach/login", authBurstLimit, login("coach"));
router.post("/auth/client/login", authBurstLimit, login("client"));
router.post("/auth/token/login", authBurstLimit, async (req, res) => {
  const parsed = TokenLoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "username and password are required" }); return; }
  const { username, password, role } = parsed.data;
  const found = await findCredentials(username, password, role);
  if (!found || (found.type === "client" && found.row.status === "inactive")) { res.status(401).json({ error: "Invalid username or password" }); return; }
  if (found.row.emailVerificationRequired && !found.row.emailVerifiedAt) { res.status(403).json({ error: "Email verification required", code: "EMAIL_NOT_VERIFIED" }); return; }
  const tokens = await issueNativeTokens(found.type, found.row.id, metadata(req, parsed.data.deviceLabel));
  res.json({ ...tokens, role: found.type, id: found.row.id });
});
router.post("/auth/token/refresh", authBurstLimit, async (req, res) => {
  const parsed = RefreshTokenBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "refreshToken is required" }); return; }
  const token = parsed.data.refreshToken;
  const tokens = await rotateNativeTokens(token);
  if (!tokens) { res.status(401).json({ error: "Invalid refresh token" }); return; }
  const { actorType, actorId, ...pair } = tokens;
  res.json({ ...pair, role: actorType, id: actorId });
});
router.post("/auth/token/revoke", async (req, res) => {
  const parsed = RefreshTokenBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "refreshToken is required" }); return; }
  if (!await revokeNativeRefreshToken(parsed.data.refreshToken)) { res.status(401).json({ error: "Invalid refresh token" }); return; }
  res.json({ ok: true });
});
router.post("/auth/logout", async (req, res) => {
  if (req.session.authSessionId) await pool.query("update auth_sessions set revoked_at=now() where id=$1", [req.session.authSessionId]);
  req.session.destroy(error => error ? res.status(500).json({ error: "Logout failed" }) : (res.clearCookie("trak_session"), res.json({ ok: true })));
});
router.get("/auth/me", async (req, res) => {
  const actor = await resolveActor(req);
  if (!actor) { res.status(401).json({ error: "Not logged in" }); return; }
  res.json(actor.type === "coach" ? { role: "coach", id: actor.coach.id, name: actor.coach.name } : { role: "client", id: actor.client.id, name: actor.client.name });
});
router.get("/auth/sessions", async (req, res) => {
  const actor = await resolveActor(req); if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = actor.type === "coach" ? actor.coach.id : actor.client.id;
  const rows = await pool.query("select id, kind, device_label, created_at, last_used_at, expires_at, (id=$3) as current from auth_sessions where actor_type=$1 and actor_id=$2 and revoked_at is null and expires_at > now() order by last_used_at desc", [actor.type, id, req.authSessionId ?? ""]);
  res.json(rows.rows);
});
router.delete("/auth/sessions/:sessionId", async (req, res) => {
  const actor = await resolveActor(req); if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = actor.type === "coach" ? actor.coach.id : actor.client.id;
  await pool.query("update auth_sessions set revoked_at=now() where id=$1 and actor_type=$2 and actor_id=$3", [req.params.sessionId, actor.type, id]); res.status(204).send();
});
router.post("/auth/sessions/revoke-all", async (req, res) => {
  const actor = await resolveActor(req); if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = actor.type === "coach" ? actor.coach.id : actor.client.id; await pool.query("update auth_sessions set revoked_at=now() where actor_type=$1 and actor_id=$2 and revoked_at is null", [actor.type, id]); res.json({ ok: true });
});
router.post("/auth/password-reset/request", authBurstLimit, async (req, res) => {
  const parsed = RequestPasswordResetBody.safeParse(req.body);
  const email = parsed.success ? parsed.data.email : undefined;
  if (email) { const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.email, email)); const [client] = coach ? [] : await db.select().from(clientsTable).where(eq(clientsTable.email, email)); const actor = coach ? { type: "coach" as const, row: coach } : client ? { type: "client" as const, row: client } : null; if (actor) { const { token } = await issueActionToken(actor.type, actor.row.id, "password_reset"); const url = authPageUrl(actor.type, "reset-password", token); void sendGmail({ to: actor.row.email, subject: "Reset your TrakAI password", html: `<p><a href="${escapeHtml(url)}">Reset your password</a></p>` }); } }
  res.json({ ok: true }); // enumeration-safe
});
router.post("/auth/password-reset/confirm", authBurstLimit, async (req, res) => {
  const parsed = ConfirmPasswordResetBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Valid token and password are required" }); return; }
  const { token, password } = parsed.data;
  const hash = await bcrypt.hash(password, 12);
  const connection = await pool.connect();
  try {
    await connection.query("begin");
    const consumed = await connection.query(
      `update auth_action_tokens
       set used_at=now()
       where token_hash=$1 and purpose='password_reset' and used_at is null and expires_at > now()
       returning actor_type, actor_id`,
      [tokenHash(token)],
    );
    const actor = consumed.rows[0] as { actor_type: "coach" | "client"; actor_id: number } | undefined;
    if (!actor) {
      await connection.query("rollback");
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }
    const tableName = actor.actor_type === "coach" ? "coaches" : "clients";
    const changed = await connection.query(
      `update ${tableName} set password_hash=$1 where id=$2 returning id`,
      [hash, actor.actor_id],
    );
    if (!changed.rowCount) throw new Error("Password reset actor no longer exists");
    await connection.query(
      "update auth_sessions set revoked_at=now() where actor_type=$1 and actor_id=$2 and revoked_at is null",
      [actor.actor_type, actor.actor_id],
    );
    await connection.query("commit");
    res.json({ ok: true });
  } catch (error) {
    await connection.query("rollback");
    req.log.error(error, "Password reset confirmation failed");
    res.status(500).json({ error: "Unable to reset password" });
  } finally {
    connection.release();
  }
});
router.post("/auth/email-verification/request", authBurstLimit, async (req, res) => {
  let actor = await resolveActor(req);
  let target: { type: "coach" | "client"; id: number; email: string } | null = actor
    ? actor.type === "coach" ? { type: "coach", id: actor.coach.id, email: actor.coach.email } : { type: "client", id: actor.client.id, email: actor.client.email }
    : null;
  if (!actor) {
    const parsed = RequestEmailVerificationBody.safeParse(req.body);
    if (!parsed.success) { res.json({ ok: true }); return; } // enumeration-safe
    if (parsed.data.role === "coach") {
      const [row] = await db.select().from(coachesTable).where(eq(coachesTable.email, parsed.data.email));
      target = row ? { type: "coach", id: row.id, email: row.email } : null;
    } else {
      const [row] = await db.select().from(clientsTable).where(eq(clientsTable.email, parsed.data.email));
      target = row ? { type: "client", id: row.id, email: row.email } : null;
    }
    if (!target) { res.json({ ok: true }); return; }
  }
  if (!target) { res.json({ ok: true }); return; }
  const issued = await issueActionToken(target.type, target.id, "email_verification");
  const url = authPageUrl(target.type, "verify-email", issued.token);
  void sendGmail({ to: target.email, subject: "Verify your TrakAI email", html: `<p><a href="${escapeHtml(url)}">Verify your email</a></p>` });
  res.json({ ok: true });
});
router.post("/auth/email-verification/confirm", authBurstLimit, async (req, res) => {
  const parsed = ConfirmEmailVerificationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "token is required" }); return; }
  const token = parsed.data.token;
  const connection = await pool.connect();
  try {
    await connection.query("begin");
    const consumed = await connection.query(
      `update auth_action_tokens
       set used_at=now()
       where token_hash=$1 and purpose='email_verification' and used_at is null and expires_at > now()
       returning actor_type, actor_id`,
      [tokenHash(token)],
    );
    const actor = consumed.rows[0] as { actor_type: "coach" | "client"; actor_id: number } | undefined;
    if (!actor) {
      await connection.query("rollback");
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }
    const tableName = actor.actor_type === "coach" ? "coaches" : "clients";
    const changed = await connection.query(
      `update ${tableName} set email_verified_at=now() where id=$1 returning id`,
      [actor.actor_id],
    );
    if (!changed.rowCount) throw new Error("Email verification actor no longer exists");
    await connection.query("commit");
    res.json({ ok: true });
  } catch (error) {
    await connection.query("rollback");
    req.log.error(error, "Email verification confirmation failed");
    res.status(500).json({ error: "Unable to verify email" });
  } finally {
    connection.release();
  }
});
export default router;