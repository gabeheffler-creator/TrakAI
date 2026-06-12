import { Router } from "express";
import { db } from "@workspace/db";
import { nutritionGoalsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const NutritionGoalBody = z.object({
  calories: z.number().int().positive().optional(),
  protein: z.number().int().nonnegative().optional(),
  carbs: z.number().int().nonnegative().optional(),
  fat: z.number().int().nonnegative().optional(),
  waterOz: z.number().int().nonnegative().optional(),
  periodType: z.enum(["day", "week", "phase"]).default("day"),
  effectiveWeek: z.number().int().positive().optional(),
  durationWeeks: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

router.get("/clients/:clientId/nutrition-goal", async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
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

router.post("/clients/:clientId/nutrition-goal", async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const body = NutritionGoalBody.parse(req.body);
    const [goal] = await db.insert(nutritionGoalsTable).values({
      clientId,
      calories: body.calories ?? null,
      protein: body.protein ?? null,
      carbs: body.carbs ?? null,
      fat: body.fat ?? null,
      waterOz: body.waterOz ?? null,
      periodType: body.periodType,
      effectiveWeek: body.effectiveWeek ?? null,
      durationWeeks: body.durationWeeks ?? null,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({ ...goal, createdAt: goal.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to set nutrition goal" });
  }
});

export default router;
