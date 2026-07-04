import { Router } from "express";
import { db } from "@workspace/db";
import { nutritionGoalsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireClientOwnership } from "../middlewares/auth";

const router = Router();

function toInt(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}

router.get("/clients/:clientId/nutrition-goal", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
    const [goal] = await db.select().from(nutritionGoalsTable)
      .where(eq(nutritionGoalsTable.clientId, clientId))
      .orderBy(desc(nutritionGoalsTable.createdAt))
      .limit(1);
    res.json(goal ? { ...goal, createdAt: goal.createdAt.toISOString() } : null);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch nutrition goal" });
  }
});

router.post("/clients/:clientId/nutrition-goal", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
    const body = req.body as Record<string, unknown>;
    const periodType = (["day", "week", "phase"] as const).includes(body.periodType as never)
      ? (body.periodType as "day" | "week" | "phase")
      : "day";
    const [goal] = await db.insert(nutritionGoalsTable).values({
      clientId,
      calories: toInt(body.calories),
      protein: toInt(body.protein),
      carbs: toInt(body.carbs),
      fat: toInt(body.fat),
      waterOz: toInt(body.waterOz),
      periodType,
      effectiveWeek: toInt(body.effectiveWeek),
      durationWeeks: toInt(body.durationWeeks),
      notes: typeof body.notes === "string" ? body.notes : null,
    }).returning();
    res.status(201).json({ ...goal, createdAt: goal.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to set nutrition goal" });
  }
});

export default router;
