import type { RequestHandler } from "express";
import { db, coachesTable, clientsTable, type Coach, type Client } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

declare module "express-session" {
  interface SessionData {
    coachId?: number;
    clientId?: number;
  }
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

export const requireCoachAuth: RequestHandler = async (req, res, next) => {
  try {
    const coachId = req.session?.coachId;
    if (!coachId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, coachId));
    if (!coach) {
      req.session.destroy(() => undefined);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.actor = { type: "coach", coach };
    next();
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Failed to resolve coach" });
  }
};

export const requireClientAuth: RequestHandler = async (req, res, next) => {
  try {
    const clientId = req.session?.clientId;
    if (!clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) {
      req.session.destroy(() => undefined);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (client.status === "inactive") {
      res.status(403).json({ error: "This account has been deactivated by your coach", code: "CLIENT_DEACTIVATED" });
      return;
    }
    req.actor = { type: "client", client };
    next();
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Failed to resolve client" });
  }
};

export const requireCoachOnly: RequestHandler = (req, res, next) => {
  if (req.actor?.type !== "coach") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

export const requireClientOwnership = (paramName = "clientId"): RequestHandler => {
  return async (req, res, next) => {
    try {
      const requestedClientId = Number(req.params[paramName]);

      if (req.session?.clientId) {
        const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.session.clientId));
        if (!client) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        if (client.id !== requestedClientId) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        if (client.status === "inactive") {
          res.status(403).json({ error: "This account has been deactivated by your coach", code: "CLIENT_DEACTIVATED" });
          return;
        }
        req.actor = { type: "client", client };
        next();
        return;
      }

      if (req.session?.coachId) {
        const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, req.session.coachId));
        if (!coach) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, requestedClientId));
        if (!client || client.coachId !== coach.id) {
          res.status(404).json({ error: "Client not found" });
          return;
        }
        req.actor = { type: "coach", coach };
        next();
        return;
      }

      res.status(401).json({ error: "Unauthorized" });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to authorize request" });
    }
  };
};
