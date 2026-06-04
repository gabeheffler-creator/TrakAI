import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListMessagesParams,
  SendMessageParams,
  SendMessageBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/clients/:clientId/messages", async (req, res) => {
  try {
    const { clientId } = ListMessagesParams.parse({ clientId: Number(req.params.clientId) });
    const rows = await db.select().from(messagesTable)
      .where(eq(messagesTable.clientId, clientId))
      .orderBy(messagesTable.createdAt);
    res.json(rows.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
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
    res.status(201).json({ ...m, createdAt: m.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to send message" });
  }
});

export default router;
