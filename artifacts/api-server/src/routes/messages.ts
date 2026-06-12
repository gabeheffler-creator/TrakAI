import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, pushSubscriptionsTable, clientsTable } from "@workspace/db";
import { eq, isNull, and, sql, count, desc } from "drizzle-orm";
import webpush from "web-push";
import {
  ListMessagesParams,
  SendMessageParams,
  SendMessageBody,
  MarkMessagesReadParams,
  MarkMessagesReadBody,
  SavePushSubscriptionBody,
} from "@workspace/api-zod";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? "mailto:admin@trakcoach.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const router = Router();

router.get("/coach/conversations", async (req, res) => {
  try {
    const clients = await db.select().from(clientsTable).orderBy(clientsTable.name);

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

router.get("/clients/:clientId/messages", async (req, res) => {
  try {
    const { clientId } = ListMessagesParams.parse({ clientId: Number(req.params.clientId) });
    const rows = await db.select().from(messagesTable)
      .where(eq(messagesTable.clientId, clientId))
      .orderBy(messagesTable.createdAt);
    res.json(rows.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/clients/:clientId/messages", async (req, res) => {
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

router.patch("/clients/:clientId/messages/read", async (req, res) => {
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

router.get("/coach/unread-count", async (req, res) => {
  try {
    const rows = await db
      .select({ clientId: messagesTable.clientId, count: sql<string>`count(*)` })
      .from(messagesTable)
      .where(and(eq(messagesTable.sender, "client"), isNull(messagesTable.readAt)))
      .groupBy(messagesTable.clientId);

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
    const body = SavePushSubscriptionBody.parse(req.body);
    await db.insert(pushSubscriptionsTable).values({
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      role: body.role,
      clientId: body.clientId ?? null,
    }).onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { p256dh: body.p256dh, auth: body.auth, role: body.role, clientId: body.clientId ?? null },
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
  const subs = recipientRole === "client"
    ? await db.select().from(pushSubscriptionsTable).where(
        and(eq(pushSubscriptionsTable.role, "client"), eq(pushSubscriptionsTable.clientId, clientId))
      )
    : await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.role, "coach"));

  const payload = JSON.stringify({
    title: sender === "coach" ? "Message from your coach" : `Message from ${clientName}`,
    body: content.slice(0, 120),
    tag: `msg-${clientId}`,
    url: sender === "coach" ? "/client/messages" : `/messages/${clientId}`,
  });

  for (const sub of subs) {
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    ).catch(err => {
      if (err.statusCode === 410) {
        db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, sub.endpoint)).catch(() => {});
      } else {
        log.warn({ err }, "Push send failed");
      }
    });
  }
}

export default router;
