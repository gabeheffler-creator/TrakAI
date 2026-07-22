import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable,
  workoutLogsTable,
  nutritionLogsTable,
  sleepLogsTable,
  measurementsTable,
  progressPhotosTable,
  programAssignmentsTable,
  programsTable,
  clientGoalHistoryTable,
  clientTasksTable,
} from "@workspace/db";
import { eq, sql, desc, and, inArray, lt } from "drizzle-orm";
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
  GetClientActivityHeatmapParams,
  CreateClientGoalBody,
  ListClientGoalHistoryParams,
} from "@workspace/api-zod";
import { requireCoachAuth, requireClientOwnership, requireCoachOnly, requireClientAuth } from "../middlewares/auth";
import { sendGmail } from "../lib/mail";

const router = Router();

function statusChangeEmailHtml(clientName: string, status: "active" | "inactive") {
  const isActive = status === "active";
  const heading = isActive ? "Your TrakAI access has been restored" : "Your TrakAI access is paused";
  const message = isActive
    ? `Hi ${clientName}, good news — your coach has restored your access to TrakAI. You can sign back in and pick up right where you left off.`
    : `Hi ${clientName}, your coach has paused your access to TrakAI. You won't be able to sign in while your account is paused. If you have questions, please contact your coach.`;

  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 8px;">${heading}</h2>
      <p style="color: #555; margin: 0 0 24px;">${message}</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">If you didn't expect this email, please contact your coach.</p>
    </div>
  `;
}

// List clients (coach's own roster only)
router.get("/clients", requireCoachAuth, async (req, res) => {
  try {
    const actor = req.actor;
    const coach = actor?.type === "coach" ? actor.coach : null;
    const rows = await db
      .select({
        id: clientsTable.id,
        coachId: clientsTable.coachId,
        name: clientsTable.name,
        email: clientsTable.email,
        phone: clientsTable.phone,
        goal: clientsTable.goal,
        goalTargetDate: clientsTable.goalTargetDate,
        notes: clientsTable.notes,
        inviteToken: clientsTable.inviteToken,
        inviteTokenUsed: clientsTable.inviteTokenUsed,
        status: clientsTable.status,
        createdAt: clientsTable.createdAt,
        updatedAt: clientsTable.updatedAt,
        programName: programsTable.name,
      })
      .from(clientsTable)
      .leftJoin(programAssignmentsTable, eq(programAssignmentsTable.clientId, clientsTable.id))
      .leftJoin(programsTable, eq(programsTable.id, programAssignmentsTable.programId))
      .where(eq(clientsTable.coachId, coach!.id))
      .orderBy(clientsTable.createdAt);
    const clientIds = rows.map(r => r.id);
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleRows = clientIds.length > 0
      ? await db.selectDistinct({ clientId: clientTasksTable.clientId })
          .from(clientTasksTable)
          .where(and(
            inArray(clientTasksTable.clientId, clientIds),
            eq(clientTasksTable.status, "pending"),
            lt(clientTasksTable.createdAt, staleCutoff),
          ))
      : [];
    const staleSet = new Set(staleRows.map(r => r.clientId));

    res.json(rows.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      hasStalePendingTask: staleSet.has(r.id),
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

    if (client.email) {
      const subject = status === "active"
        ? "Your TrakAI access has been restored"
        : "Your TrakAI access is paused";
      sendGmail({
        to: client.email,
        subject,
        html: statusChangeEmailHtml(client.name, status),
      }).then((result) => {
        if (!result.ok) {
          req.log.error({ status: result.status, body: result.body, clientId }, "Gmail status-change API error");
        } else {
          req.log.info({ clientId, status }, "Client status-change email sent");
        }
      }).catch((err) => {
        req.log.error({ err, clientId }, "Failed to send client status-change email");
      });
    }
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update client status" });
  }
});

// Calendar heatmap of days a client logged data (workouts, nutrition, sleep,
// measurements, or progress photos) over the trailing 365 days.
router.get("/clients/:clientId/activity-heatmap", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = GetClientActivityHeatmapParams.parse({ clientId: Number(req.params.clientId) });
    const since = new Date();
    since.setDate(since.getDate() - 365);
    const sinceStr = since.toISOString().split("T")[0];

    const tables = [workoutLogsTable, nutritionLogsTable, sleepLogsTable, measurementsTable, progressPhotosTable];
    const perTableCounts = await Promise.all(tables.map((table) =>
      db.select({ date: table.date, count: sql<number>`count(*)`.mapWith(Number) })
        .from(table)
        .where(sql`${table.clientId} = ${clientId} and ${table.date} >= ${sinceStr}`)
        .groupBy(table.date)
    ));

    const totals = new Map<string, number>();
    for (const rows of perTableCounts) {
      for (const row of rows) {
        totals.set(row.date, (totals.get(row.date) ?? 0) + row.count);
      }
    }

    const entries = Array.from(totals.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(entries);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get client activity heatmap" });
  }
});

// Create a new goal — archives the current goal to history, sets the new one
router.post("/clients/:clientId/goals", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = GetClientParams.parse({ clientId: Number(req.params.clientId) });
    const body = CreateClientGoalBody.parse(req.body);

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(clientsTable).where(eq(clientsTable.id, clientId));
      if (!existing) throw Object.assign(new Error("Client not found"), { notFound: true });

      if (existing.goal) {
        await tx.insert(clientGoalHistoryTable).values({
          clientId,
          goal: existing.goal,
          goalTargetDate: existing.goalTargetDate ?? null,
        });
      }

      const [client] = await tx.update(clientsTable)
        .set({ goal: body.goal, goalTargetDate: body.goalTargetDate ?? null, updatedAt: new Date() })
        .where(eq(clientsTable.id, clientId))
        .returning();
      return client;
    });

    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err: unknown) {
    if (err instanceof Error && (err as { notFound?: boolean }).notFound) {
      res.status(404).json({ error: "Client not found" });
    } else {
      req.log.error(err);
      res.status(400).json({ error: "Failed to create goal" });
    }
  }
});

// List archived goals for a client, newest first (coach or the client themselves)
router.get("/clients/:clientId/goals/history", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = ListClientGoalHistoryParams.parse({ clientId: Number(req.params.clientId) });
    const history = await db.select().from(clientGoalHistoryTable)
      .where(eq(clientGoalHistoryTable.clientId, clientId))
      .orderBy(desc(clientGoalHistoryTable.archivedAt));
    res.json(history.map(h => ({ ...h, archivedAt: h.archivedAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get goal history" });
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


export default router;
