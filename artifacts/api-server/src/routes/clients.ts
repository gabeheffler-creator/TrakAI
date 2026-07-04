import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  CreateClientBody,
  UpdateClientBody,
  GetClientParams,
  UpdateClientParams,
  DeleteClientParams,
  GenerateInviteLinkParams,
  GetInviteParams,
  UpdateClientStatusBody,
  UpdateClientStatusParams,
} from "@workspace/api-zod";
import { requireCoachAuth, requireClientOwnership, requireCoachOnly, requireClientAuth, getUserEmail } from "../middlewares/auth";

const router = Router();

// List clients (coach's own roster only)
router.get("/clients", requireCoachAuth, async (req, res) => {
  try {
    const actor = req.actor;
    const coach = actor?.type === "coach" ? actor.coach : null;
    const clients = await db.select().from(clientsTable)
      .where(eq(clientsTable.coachId, coach!.id))
      .orderBy(clientsTable.createdAt);
    res.json(clients.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list clients" });
  }
});

// Create client
router.post("/clients", requireCoachAuth, async (req, res) => {
  try {
    const body = CreateClientBody.parse(req.body);
    const actor = req.actor;
    const coach = actor?.type === "coach" ? actor.coach : null;
    const [client] = await db.insert(clientsTable).values({
      coachId: coach!.id,
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      goal: body.goal ?? null,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({ ...client, createdAt: client.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create client" });
  }
});

// Get the client record for the currently signed-in Clerk user (client app identity
// bootstrap). Must be registered before "/clients/:clientId" or Express will match
// "me" as the :clientId param.
router.get("/clients/me", requireClientAuth, async (req, res) => {
  try {
    if (req.actor?.type !== "client") { res.status(404).json({ error: "No client account found" }); return; }
    const { client } = req.actor;
    res.json({ ...client, createdAt: client.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get client" });
  }
});

router.get("/clients/:clientId", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = GetClientParams.parse({ clientId: Number(req.params.clientId) });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ ...client, createdAt: client.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get client" });
  }
});

// Update client
router.patch("/clients/:clientId", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = UpdateClientParams.parse({ clientId: Number(req.params.clientId) });
    const body = UpdateClientBody.parse(req.body);
    const [client] = await db.update(clientsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(clientsTable.id, clientId))
      .returning();
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ ...client, createdAt: client.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update client" });
  }
});

// Activate / deactivate client (coach only)
router.patch("/clients/:clientId/status", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = UpdateClientStatusParams.parse({ clientId: Number(req.params.clientId) });
    const { status } = UpdateClientStatusBody.parse(req.body);
    const [client] = await db.update(clientsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(clientsTable.id, clientId))
      .returning();
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ ...client, createdAt: client.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update client status" });
  }
});

// Delete client (coach only)
router.delete("/clients/:clientId", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = DeleteClientParams.parse({ clientId: Number(req.params.clientId) });
    await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

// Generate invite link (coach only)
router.post("/clients/:clientId/invite", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = GenerateInviteLinkParams.parse({ clientId: Number(req.params.clientId) });
    const token = randomBytes(16).toString("hex");
    const [client] = await db.update(clientsTable)
      .set({ inviteToken: token, updatedAt: new Date() })
      .where(eq(clientsTable.id, clientId))
      .returning();
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ token, url: `/client/join/${token}` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate invite" });
  }
});

// Get invite info (validate only — does NOT consume the token, no auth required
// since the invited person hasn't signed in yet)
router.get("/invite/:token", async (req, res) => {
  try {
    const { token } = GetInviteParams.parse({ token: req.params.token });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.inviteToken, token));
    if (!client) { res.status(404).json({ error: "Invalid or expired token" }); return; }
    res.json({ clientId: client.id, clientName: client.name, clientEmail: client.email });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get invite" });
  }
});

// Accept invite — requires the caller to already be signed in via Clerk with
// the SAME email as the invited client. Links the Clerk account to the client
// row and marks the token as used.
router.post("/invite/:token/accept", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { token } = GetInviteParams.parse({ token: req.params.token });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.inviteToken, token));
    if (!client) { res.status(404).json({ error: "Invalid or expired token" }); return; }

    const email = await getUserEmail(auth.userId);

    if (client.clerkUserId && client.clerkUserId !== auth.userId) {
      res.status(403).json({ error: "This invite has already been claimed by another account" });
      return;
    }

    if (!client.clerkUserId) {
      if (!email || email.toLowerCase() !== client.email.toLowerCase()) {
        res.status(403).json({ error: "Sign in with the email address this invite was sent to" });
        return;
      }
      await db.update(clientsTable)
        .set({ clerkUserId: auth.userId, inviteTokenUsed: true, updatedAt: new Date() })
        .where(eq(clientsTable.id, client.id));
    }

    res.json({ clientId: client.id, clientName: client.name, alreadyJoined: client.inviteTokenUsed });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to accept invite" });
  }
});

export default router;
