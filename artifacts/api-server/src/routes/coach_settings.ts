import { Router } from "express";
import { db } from "@workspace/db";
import { coachSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireCoachAuth } from "../middlewares/auth";

const router = Router();

router.get("/coach/app-settings", requireCoachAuth, async (req, res) => {
  try {
    const actor = req.actor;
    const coachId = actor?.type === "coach" ? actor.coach.id : -1;
    const [row] = await db.select().from(coachSettingsTable).where(eq(coachSettingsTable.coachId, coachId)).limit(1);
    const settings = row ? JSON.parse(row.settingsJson) : {};
    res.json(settings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/coach/app-settings", requireCoachAuth, async (req, res) => {
  try {
    const actor = req.actor;
    const coachId = actor?.type === "coach" ? actor.coach.id : -1;
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const [existing] = await db.select().from(coachSettingsTable).where(eq(coachSettingsTable.coachId, coachId)).limit(1);
    const current = existing ? JSON.parse(existing.settingsJson) : {};
    const merged = { ...current, ...body };
    const jsonStr = JSON.stringify(merged);
    if (existing) {
      await db.update(coachSettingsTable).set({ settingsJson: jsonStr, updatedAt: new Date() }).where(eq(coachSettingsTable.coachId, coachId));
    } else {
      await db.insert(coachSettingsTable).values({ coachId, settingsJson: jsonStr });
    }
    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update settings" });
  }
});

export default router;
