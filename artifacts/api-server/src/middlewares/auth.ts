import type { Request, RequestHandler } from "express";
import { db, coachesTable, clientsTable, pool, type Coach, type Client } from "@workspace/db";
import { eq } from "drizzle-orm";
import { tokenHash, safeEqualHash } from "../lib/tokens";

declare module "express-session" { interface SessionData { authSessionId?: string; coachId?: number; clientId?: number; } }
declare global { namespace Express { interface Request { actor?: { type: "coach"; coach: Coach } | { type: "client"; client: Client }; authSessionId?: string; } } }
type Actor = NonNullable<Request["actor"]>;

async function actorFor(type: "coach" | "client", id: number): Promise<Actor | null> {
  if (type === "coach") {
    const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, id));
    return coach ? { type, coach } : null;
  }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  return client ? { type, client } : null;
}

async function resolve(req: Request): Promise<Actor | null> {
  if (req.actor) return req.actor;
  const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization : undefined;
  let sessionId: string | undefined;
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) return null; // bearer is authoritative, including malformed input
    const result = await pool.query(`select * from auth_sessions where access_token_hash = $1 and kind='native'`, [tokenHash(match[1])]);
    const row = result.rows[0];
    if (!row || row.revoked_at || new Date(row.access_expires_at).getTime() <= Date.now()) return null;
    sessionId = row.id;
    const actor = await actorFor(row.actor_type, row.actor_id);
    if (!actor || (actor.type === "client" && actor.client.status === "inactive")) return null;
    req.actor = actor; req.authSessionId = sessionId;
    void pool.query("update auth_sessions set last_used_at=now() where id=$1", [sessionId]);
    return actor;
  }
  sessionId = req.session?.authSessionId;
  if (!sessionId) return null;
  const result = await pool.query(`select * from auth_sessions where id=$1 and kind='cookie'`, [sessionId]);
  const row = result.rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return null;
  const actor = await actorFor(row.actor_type, row.actor_id);
  if (!actor || (actor.type === "client" && actor.client.status === "inactive")) return null;
  req.actor = actor; req.authSessionId = sessionId;
  void pool.query("update auth_sessions set last_used_at=now() where id=$1", [sessionId]);
  return actor;
}

function denyInactive(res: Parameters<RequestHandler>[1], actor: Actor) {
  if (actor.type === "client" && actor.client.status === "inactive") { res.status(403).json({ error: "This account has been deactivated by your coach", code: "CLIENT_DEACTIVATED" }); return true; }
  return false;
}
export const requireCoachAuth: RequestHandler = async (req, res, next) => {
  try { const actor = await resolve(req); if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; } if (denyInactive(res, actor)) return; if (actor.type !== "coach") { res.status(403).json({ error: "Forbidden" }); return; } next(); } catch (error) { req.log.error(error); res.status(500).json({ error: "Failed to resolve identity" }); }
};
export const requireClientAuth: RequestHandler = async (req, res, next) => {
  try { const actor = await resolve(req); if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; } if (denyInactive(res, actor)) return; if (actor.type !== "client") { res.status(403).json({ error: "Forbidden" }); return; } next(); } catch (error) { req.log.error(error); res.status(500).json({ error: "Failed to resolve identity" }); }
};
export const requireCoachOnly: RequestHandler = (req, res, next) => req.actor?.type === "coach" ? next() : res.status(403).json({ error: "Forbidden" });
export const requireClientOwnership = (paramName = "clientId"): RequestHandler => async (req, res, next) => {
  try {
    const requestedId = Number(req.params[paramName]);
    // Resolve identity first: a bearer/cookie client identity must never be shadowed by a coach identity.
    const actor = await resolve(req);
    if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (denyInactive(res, actor)) return;
    if (actor.type === "client") { if (actor.client.id !== requestedId) { res.status(403).json({ error: "Forbidden" }); return; } next(); return; }
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, requestedId));
    if (!client || client.coachId !== actor.coach.id) { res.status(404).json({ error: "Client not found" }); return; }
    next();
  } catch (error) { req.log.error(error); res.status(500).json({ error: "Failed to authorize request" }); }
};
export const resolveActor = resolve;