import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { db, coachesTable, clientsTable, type Coach, type Client } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { clerkClient } from "../lib/clerkClient";

/**
 * Session token claims don't include email by default on this Clerk instance,
 * so we resolve identity (email + name) via the Clerk Backend API instead of
 * `auth.sessionClaims`. Prefer the verified primary email; fall back to the
 * first verified email if no primary is set.
 */
async function getUserIdentity(userId: string): Promise<{ email: string | undefined; name: string | undefined }> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  const verified = user.emailAddresses.find((e) => e.verification?.status === "verified");
  const email = (primary ?? verified ?? user.emailAddresses[0])?.emailAddress;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || undefined;
  return { email, name };
}

/** Exported for routes (e.g. invite accept) that need just the signed-in user's email. */
export async function getUserEmail(userId: string): Promise<string | undefined> {
  const { email } = await getUserIdentity(userId);
  return email;
}

declare global {
  namespace Express {
    interface Request {
      actor?:
        | { type: "coach"; coach: Coach }
        | { type: "client"; client: Client };
    }
  }
}

async function getOrCreateCoach(clerkUserId: string, email: string, name: string): Promise<Coach> {
  const [existing] = await db.select().from(coachesTable).where(eq(coachesTable.clerkUserId, clerkUserId));
  if (existing) return existing;

  // Claim a legacy unclaimed coach row (pre-auth beta data) so the first coach
  // to sign in keeps the existing client roster instead of starting empty.
  const [legacy] = await db.select().from(coachesTable).where(isNull(coachesTable.clerkUserId)).limit(1);
  if (legacy) {
    const [claimed] = await db
      .update(coachesTable)
      .set({ clerkUserId, email, name })
      .where(eq(coachesTable.id, legacy.id))
      .returning();
    return claimed;
  }

  const [created] = await db.insert(coachesTable).values({ clerkUserId, email, name }).returning();
  return created;
}

async function getClientForClerkUser(clerkUserId: string, email: string | undefined): Promise<Client | null> {
  const [existing] = await db.select().from(clientsTable).where(eq(clientsTable.clerkUserId, clerkUserId));
  if (existing) return existing;

  if (!email) return null;

  // Claim an invited client row (created by a coach) that matches this email
  // and hasn't been linked to a Clerk account yet.
  const [invited] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.email, email), isNull(clientsTable.clerkUserId)));
  if (!invited) return null;

  const [claimed] = await db
    .update(clientsTable)
    .set({ clerkUserId, updatedAt: new Date() })
    .where(eq(clientsTable.id, invited.id))
    .returning();
  return claimed;
}

/**
 * Coach-facing routes: any signed-in Clerk user is JIT-provisioned as a coach
 * (or claims the legacy unclaimed coach row). Attaches req.actor = { type: "coach", coach }.
 */
export const requireCoachAuth: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { email, name } = await getUserIdentity(auth.userId);
    const coach = await getOrCreateCoach(auth.userId, email ?? `${auth.userId}@unknown.local`, name ?? "Coach");
    req.actor = { type: "coach", coach };
    next();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to resolve coach" });
  }
};

/**
 * Client-facing routes: signed-in Clerk user must already be (or become, via
 * email-matched invite claim) a client. Clients cannot self-register.
 */
export const requireClientAuth: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { email } = await getUserIdentity(auth.userId);
    const client = await getClientForClerkUser(auth.userId, email);
    if (!client) {
      res.status(403).json({ error: "No client account found for this user" });
      return;
    }
    req.actor = { type: "client", client };
    next();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to resolve client" });
  }
};

/**
 * Use after requireClientOwnership (or requireCoachAuth) to further restrict
 * an endpoint to coach callers only, even though a client may otherwise pass
 * the ownership check (e.g. deleting a client record, generating invites).
 */
export const requireCoachOnly: RequestHandler = (req, res, next) => {
  if (req.actor?.type !== "coach") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

/**
 * Shared per-client routes (used by both the coach app and the client app),
 * e.g. /clients/:clientId/workout-logs. Resolves the caller as either a coach
 * or a client, then enforces that the :clientId param belongs to them.
 */
export const requireClientOwnership = (paramName = "clientId"): RequestHandler => {
  return async (req, res, next) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const requestedClientId = Number(req.params[paramName]);

      // Check the client identity first: a Clerk user who happens to also have
      // a coach account elsewhere (e.g. they signed up as a coach separately)
      // should still be treated as the client for their OWN client record,
      // rather than being shadowed by their unrelated coach account.
      const { email } = await getUserIdentity(auth.userId);
      const directClient = await getClientForClerkUser(auth.userId, email);
      if (directClient && directClient.id === requestedClientId) {
        req.actor = { type: "client", client: directClient };
        next();
        return;
      }

      const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.clerkUserId, auth.userId));
      if (coach) {
        const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, requestedClientId));
        if (!client || client.coachId !== coach.id) {
          res.status(404).json({ error: "Client not found" });
          return;
        }
        req.actor = { type: "coach", coach };
        next();
        return;
      }

      if (!directClient) {
        res.status(403).json({ error: "No account found for this user" });
        return;
      }
      res.status(403).json({ error: "Forbidden" });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to authorize request" });
    }
  };
};
