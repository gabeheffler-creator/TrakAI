import { Router } from "express";

const router = Router();

const activeCalls = new Map<number, Date>();

router.post("/clients/:id/video-call/start", (req, res) => {
  const id = Number(req.params.id);
  activeCalls.set(id, new Date());
  res.json({ active: true, startedAt: activeCalls.get(id)!.toISOString() });
});

router.post("/clients/:id/video-call/end", (req, res) => {
  const id = Number(req.params.id);
  activeCalls.delete(id);
  res.json({ active: false, startedAt: null });
});

router.get("/clients/:id/video-call/status", (req, res) => {
  const id = Number(req.params.id);
  const startedAt = activeCalls.get(id);
  res.json({ active: !!startedAt, startedAt: startedAt?.toISOString() ?? null });
});

export default router;
