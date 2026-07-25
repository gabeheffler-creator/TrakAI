import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, pushSubscriptionsTable, clientsTable, clientTasksTable } from "@workspace/db";
import { eq, isNull, and, sql, count, desc, inArray } from "drizzle-orm";
import {
  ListMessagesParams,
  SendMessageParams,
  SendMessageBody,
  MarkMessagesReadParams,
  MarkMessagesReadBody,
  SavePushSubscriptionBody,
} from "@workspace/api-zod";
import { requireCoachAuth, requireClientOwnership } from "../middlewares/auth";
import { sendPushToSubs } from "../lib/push";

const router = Router();

router.get("/coach/conversations", requireCoachAuth, async (req, res) => {
  try {
    const actor = req.actor;
    const coachId = actor?.type === "coach" ? actor.coach.id : -1;
    const clients = await db.select().from(clientsTable).where(eq(clientsTable.coachId, coachId)).orderBy(clientsTable.name);

    const conversations = await Promise.all(clients.map(async (c) => {
      const [lastMsg] = await db.select()
        .from(messagesTable)
        .where(eq(messagesTable.clientId, c.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      const [{ unreadCount }] = await db
        .select({ unreadCount: count() })
        .from(messagesTable)
        .where(and(
          eq(messagesTable.clientId, c.id),
          eq(messagesTable.sender, "client"),
          isNull(messagesTable.readAt),
        ));

      return {
        clientId: c.id,
        name: c.name,
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          sender: lastMsg.sender,
          createdAt: lastMsg.createdAt.toISOString(),
        } : null,
        unreadCount: Number(unreadCount),
      };
    }));

    res.json(conversations);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/clients/:clientId/messages", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = ListMessagesParams.parse({ clientId: Number(req.params.clientId) });
    const rows = await db.select().from(messagesTable)
      .where(eq(messagesTable.clientId, clientId))
      .orderBy(messagesTable.createdAt);
    // Fetch tasks for messages that reference them
    const taskIds = [...new Set(rows.map(r => r.taskId).filter((id): id is number => id != null))];
    const tasks = taskIds.length > 0
      ? await db.select().from(clientTasksTable).where(
          inArray(clientTasksTable.id, taskIds)
        )
      : [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    res.json(rows.map(m => {
      const task = m.taskId != null ? taskMap.get(m.taskId) ?? null : null;
      return {
        ...m,
        messageType: m.messageType ?? "text",
        taskId: m.taskId ?? null,
        task: task ? {
          id: task.id,
          clientId: task.clientId,
          text: task.text,
          status: task.status,
          rejectionReason: task.rejectionReason ?? null,
          alternativeText: task.alternativeText ?? null,
          altStatus: task.altStatus ?? null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        } : null,
        createdAt: m.createdAt.toISOString(),
        readAt: m.readAt?.toISOString() ?? null,
      };
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/clients/:clientId/messages", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = SendMessageParams.parse({ clientId: Number(req.params.clientId) });
    const body = SendMessageBody.parse(req.body);
    const [m] = await db.insert(messagesTable).values({
      clientId,
      sender: body.sender,
      content: body.content,
    }).returning();

    const result = { ...m, createdAt: m.createdAt.toISOString(), readAt: null as string | null };
    void sendPushForMessage(clientId, body.sender, body.content, req.log).catch(() => {});
    res.status(201).json(result);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to send message" });
  }
});

router.patch("/clients/:clientId/messages/read", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = MarkMessagesReadParams.parse({ clientId: Number(req.params.clientId) });
    const body = MarkMessagesReadBody.parse(req.body);
    const senderToMark = body.reader === "coach" ? "client" : "coach";
    const now = new Date();
    const updated = await db.update(messagesTable)
      .set({ readAt: now })
      .where(and(
        eq(messagesTable.clientId, clientId),
        eq(messagesTable.sender, senderToMark),
        isNull(messagesTable.readAt),
      ))
      .returning();
    res.json({ marked: updated.length });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to mark messages read" });
  }
});

router.get("/coach/unread-count", requireCoachAuth, async (req, res) => {
  try {
    const actor = req.actor;
    const coachId = actor?.type === "coach" ? actor.coach.id : -1;
    const coachClients = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.coachId, coachId));
    const clientIds = coachClients.map(c => c.id);
    const rows = clientIds.length > 0
      ? await db
          .select({ clientId: messagesTable.clientId, count: sql<string>`count(*)` })
          .from(messagesTable)
          .where(and(eq(messagesTable.sender, "client"), isNull(messagesTable.readAt), inArray(messagesTable.clientId, clientIds)))
          .groupBy(messagesTable.clientId)
      : [];

    const byClient: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const c = Number(r.count);
      byClient[String(r.clientId)] = c;
      total += c;
    }
    res.json({ total, byClient });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

router.post("/push-subscriptions", async (req, res) => {
  try {
    if (!req.session?.coachId && !req.session?.clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = SavePushSubscriptionBody.parse(req.body);
    await db.insert(pushSubscriptionsTable).values({
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      role: body.role,
      clientId: body.clientId ?? null,
    }).onConflictDoUpdate({
      target: [pushSubscriptionsTable.endpoint, pushSubscriptionsTable.clientId],
      set: { p256dh: body.p256dh, auth: body.auth, role: body.role },
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to save subscription" });
  }
});

async function sendPushForMessage(clientId: number, sender: string, content: string, log: any) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  const clientName = client?.name ?? "Client";
  const recipientRole = sender === "coach" ? "client" : "coach";

  // Deactivated clients shouldn't receive push notifications, even if a coach
  // still sends them a message (e.g. for record-keeping) after pausing access.
  if (recipientRole === "client" && client?.status === "inactive") {
    return;
  }

  // Check coach notification preferences before sending a push to the coach
  if (recipientRole === "coach" && client) {
    const { isCoachPushAllowed } = await import("../lib/push-prefs");
    const allowed = await isCoachPushAllowed(client.coachId, "messages").catch(() => true);
    if (!allowed) return;
  }

  const subs = recipientRole === "client"
    ? await db.select().from(pushSubscriptionsTable).where(
        and(eq(pushSubscriptionsTable.role, "client"), eq(pushSubscriptionsTable.clientId, clientId))
      )
    : await db.select().from(pushSubscriptionsTable).where(
        and(eq(pushSubscriptionsTable.role, "coach"), eq(pushSubscriptionsTable.clientId, clientId))
      );

  const payload = JSON.stringify({
    title: sender === "coach" ? "Message from your coach" : `Message from ${clientName}`,
    body: content.slice(0, 120),
    tag: `msg-${clientId}`,
    url: sender === "coach" ? "/client/messages" : `/messages/${clientId}`,
  });

  await sendPushToSubs(subs, payload, log);
}

export default router;
