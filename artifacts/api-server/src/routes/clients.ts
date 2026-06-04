import { Router } from "express";
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
} from "@workspace/api-zod";

const router = Router();

// List clients
router.get("/clients", async (req, res) => {
  try {
    const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);
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
router.post("/clients", async (req, res) => {
  try {
    const body = CreateClientBody.parse(req.body);
    const [client] = await db.insert(clientsTable).values({
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

// Get client
router.get("/clients/:clientId", async (req, res) => {
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
router.patch("/clients/:clientId", async (req, res) => {
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

// Delete client
router.delete("/clients/:clientId", async (req, res) => {
  try {
    const { clientId } = DeleteClientParams.parse({ clientId: Number(req.params.clientId) });
    await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

// Generate invite link
router.post("/clients/:clientId/invite", async (req, res) => {
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

// Get invite info
router.get("/invite/:token", async (req, res) => {
  try {
    const { token } = GetInviteParams.parse({ token: req.params.token });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.inviteToken, token));
    if (!client) { res.status(404).json({ error: "Invalid or expired token" }); return; }
    res.json({ clientId: client.id, clientName: client.name });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get invite" });
  }
});

export default router;
