import { Router } from "express";
import { db } from "@workspace/db";
import { sleepLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListSleepLogsParams,
  LogSleepParams,
  LogSleepBody,
  DeleteSleepLogParams,
} from "@workspace/api-zod";
import { requireClientOwnership } from "../middlewares/auth";

const router = Router();

router.get("/clients/:clientId/sleep", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = ListSleepLogsParams.parse({ clientId: Number(req.params.clientId) });
    const rows = await db.select().from(sleepLogsTable)
      .where(eq(sleepLogsTable.clientId, clientId))
      .orderBy(sleepLogsTable.date);
    res.json(rows.map(s => ({
      ...s,
      hoursSlept: Number(s.hoursSlept),
      createdAt: s.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list sleep logs" });
  }
});

router.post("/clients/:clientId/sleep", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = LogSleepParams.parse({ clientId: Number(req.params.clientId) });
    const body = LogSleepBody.parse(req.body);
    const [s] = await db.insert(sleepLogsTable).values({
      clientId,
      date: body.date instanceof Date ? body.date.toISOString().split("T")[0] : body.date,
      hoursSlept: String(body.hoursSlept),
      quality: body.quality ?? null,
      energyRating: body.energyRating ?? null,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({ ...s, hoursSlept: Number(s.hoursSlept), createdAt: s.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to log sleep" });
  }
});

router.delete("/clients/:clientId/sleep/:sleepId", requireClientOwnership(), async (req, res) => {
  try {
    const { sleepId } = DeleteSleepLogParams.parse({
      clientId: Number(req.params.clientId),
      sleepId: Number(req.params.sleepId),
    });
    await db.delete(sleepLogsTable).where(eq(sleepLogsTable.id, sleepId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete sleep log" });
  }
});

export default router;
