import { Router } from "express";
import { db } from "@workspace/db";
import { coachSettingsTable } from "@workspace/db";
import { z } from "zod/v4";

const router = Router();

router.get("/coach/app-settings", async (req, res) => {
  try {
    const [row] = await db.select().from(coachSettingsTable).limit(1);
    const settings = row ? JSON.parse(row.settingsJson) : {};
    res.json(settings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/coach/app-settings", async (req, res) => {
  try {
    const body = z.record(z.unknown()).parse(req.body);
    const [existing] = await db.select().from(coachSettingsTable).limit(1);
    const current = existing ? JSON.parse(existing.settingsJson) : {};
    const merged = { ...current, ...body };
    const jsonStr = JSON.stringify(merged);
    if (existing) {
      await db.update(coachSettingsTable).set({ settingsJson: jsonStr, updatedAt: new Date() });
    } else {
      await db.insert(coachSettingsTable).values({ settingsJson: jsonStr });
    }
    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update settings" });
  }
});

export default router;
