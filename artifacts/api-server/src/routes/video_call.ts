import { Router } from "express";
import { db } from "@workspace/db";
import { callLogsTable } from "@workspace/db";
import { requireClientOwnership } from "../middlewares/auth";

const router = Router();

const activeCalls = new Map<number, Date>();

router.post("/clients/:id/video-call/start", requireClientOwnership("id"), (req, res) => {
  const id = Number(req.params.id);
  activeCalls.set(id, new Date());
  res.json({ active: true, startedAt: activeCalls.get(id)!.toISOString() });
});

router.post("/clients/:id/video-call/end", requireClientOwnership("id"), async (req, res) => {
  const id = Number(req.params.id);
  const startedAt = activeCalls.get(id);
  activeCalls.delete(id);

  let callLogId: number | null = null;

  if (startedAt) {
    const durationMs = Date.now() - startedAt.getTime();
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    const today = new Date().toISOString().split("T")[0];
    try {
      const [inserted] = await db.insert(callLogsTable).values({
        clientId: id,
        date: today,
        durationMinutes,
        notes: null,
        source: "auto",
      }).returning({ id: callLogsTable.id });
      callLogId = inserted?.id ?? null;
    } catch (err) {
      req.log.warn({ err, clientId: id }, "Failed to auto-log video call");
    }
  }

  res.json({ active: false, startedAt: null, callLogId });
});

router.get("/clients/:id/video-call/status", requireClientOwnership("id"), (req, res) => {
  const id = Number(req.params.id);
  const startedAt = activeCalls.get(id);
  res.json({ active: !!startedAt, startedAt: startedAt?.toISOString() ?? null });
});

export default router;
