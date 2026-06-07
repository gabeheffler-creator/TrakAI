import { Router } from "express";
import { db } from "@workspace/db";
import { callLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListCallLogsParams,
  CreateCallLogParams,
  CreateCallLogBody,
  UpdateCallLogParams,
  UpdateCallLogBody,
  DeleteCallLogParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/clients/:clientId/call-logs", async (req, res) => {
  try {
    const { clientId } = ListCallLogsParams.parse({ clientId: Number(req.params.clientId) });
    const logs = await db.select().from(callLogsTable)
      .where(eq(callLogsTable.clientId, clientId))
      .orderBy(callLogsTable.date);
    res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list call logs" });
  }
});

router.post("/clients/:clientId/call-logs", async (req, res) => {
  try {
    const { clientId } = CreateCallLogParams.parse({ clientId: Number(req.params.clientId) });
    const body = CreateCallLogBody.parse(req.body);
    const dateStr = body.date instanceof Date ? body.date.toISOString().split("T")[0] : String(body.date);
    const [log] = await db.insert(callLogsTable).values({
      clientId,
      date: dateStr,
      durationMinutes: body.durationMinutes ?? null,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({ ...log, createdAt: log.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to log call" });
  }
});

router.patch("/clients/:clientId/call-logs/:callId", async (req, res) => {
  try {
    const { clientId, callId } = UpdateCallLogParams.parse({ clientId: Number(req.params.clientId), callId: Number(req.params.callId) });
    const body = UpdateCallLogBody.parse(req.body);
    const patchDateStr = body.date instanceof Date ? body.date.toISOString().split("T")[0] : body.date ? String(body.date) : undefined;
    const [log] = await db.update(callLogsTable)
      .set({ date: patchDateStr, durationMinutes: body.durationMinutes ?? null, notes: body.notes ?? null })
      .where(and(eq(callLogsTable.id, callId), eq(callLogsTable.clientId, clientId)))
      .returning();
    if (!log) { res.status(404).json({ error: "Call log not found" }); return; }
    res.json({ ...log, createdAt: log.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update call log" });
  }
});

router.delete("/clients/:clientId/call-logs/:callId", async (req, res) => {
  try {
    const { clientId, callId } = DeleteCallLogParams.parse({ clientId: Number(req.params.clientId), callId: Number(req.params.callId) });
    await db.delete(callLogsTable).where(and(eq(callLogsTable.id, callId), eq(callLogsTable.clientId, clientId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete call log" });
  }
});

export default router;
