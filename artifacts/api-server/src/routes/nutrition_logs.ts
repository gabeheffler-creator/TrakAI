import { Router } from "express";
import { db } from "@workspace/db";
import { nutritionLogsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  ListNutritionLogsParams,
  CreateNutritionLogParams,
  CreateNutritionLogBody,
  DeleteNutritionLogParams,
} from "@workspace/api-zod";
import * as z from "zod";

const UpdateNutritionLogBody = z.object({
  notes: z.string().optional().nullable(),
  calories: z.number().optional().nullable(),
  protein: z.number().optional().nullable(),
  carbs: z.number().optional().nullable(),
  fat: z.number().optional().nullable(),
});
import { requireClientOwnership } from "../middlewares/auth";

const router = Router();

router.get("/clients/:clientId/nutrition", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = ListNutritionLogsParams.parse({ clientId: Number(req.params.clientId) });
    const rows = await db.select().from(nutritionLogsTable)
      .where(eq(nutritionLogsTable.clientId, clientId))
      .orderBy(nutritionLogsTable.date);
    res.json(rows.map(n => ({
      ...n,
      protein: n.protein ? Number(n.protein) : null,
      carbs: n.carbs ? Number(n.carbs) : null,
      fat: n.fat ? Number(n.fat) : null,
      sodium: n.sodium ?? null,
      waterMl: n.waterMl ?? null,
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list nutrition logs" });
  }
});

router.post("/clients/:clientId/nutrition", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = CreateNutritionLogParams.parse({ clientId: Number(req.params.clientId) });
    const body = CreateNutritionLogBody.parse(req.body);
    const [n] = await db.insert(nutritionLogsTable).values({
      clientId,
      date: body.date instanceof Date ? body.date.toISOString().split("T")[0] : body.date,
      imageUrl: body.imageUrl,
      calories: body.calories ?? null,
      protein: body.protein != null ? String(body.protein) : null,
      carbs: body.carbs != null ? String(body.carbs) : null,
      fat: body.fat != null ? String(body.fat) : null,
      sodium: body.sodium ?? null,
      waterMl: body.waterMl ?? null,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({
      ...n,
      protein: n.protein ? Number(n.protein) : null,
      carbs: n.carbs ? Number(n.carbs) : null,
      fat: n.fat ? Number(n.fat) : null,
      sodium: n.sodium ?? null,
      waterMl: n.waterMl ?? null,
      createdAt: n.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create nutrition log" });
  }
});

router.patch("/clients/:clientId/nutrition/:nutritionId", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId, nutritionId } = DeleteNutritionLogParams.parse({
      clientId: Number(req.params.clientId),
      nutritionId: Number(req.params.nutritionId),
    });
    const body = UpdateNutritionLogBody.parse(req.body);
    const patch: Record<string, unknown> = {};
    if ("notes"    in body) patch.notes    = body.notes    ?? null;
    if ("calories" in body) patch.calories = body.calories ?? null;
    if ("protein"  in body) patch.protein  = body.protein  != null ? String(body.protein)  : null;
    if ("carbs"    in body) patch.carbs    = body.carbs    != null ? String(body.carbs)    : null;
    if ("fat"      in body) patch.fat      = body.fat      != null ? String(body.fat)      : null;
    const [n] = await db.update(nutritionLogsTable)
      .set(patch)
      .where(and(eq(nutritionLogsTable.id, nutritionId), eq(nutritionLogsTable.clientId, clientId)))
      .returning();
    if (!n) { res.status(404).json({ error: "Nutrition log not found" }); return; }
    res.json({
      ...n,
      protein: n.protein ? Number(n.protein) : null,
      carbs: n.carbs ? Number(n.carbs) : null,
      fat: n.fat ? Number(n.fat) : null,
      createdAt: n.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update nutrition log" });
  }
});

router.delete("/clients/:clientId/nutrition/:nutritionId", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId, nutritionId } = DeleteNutritionLogParams.parse({
      clientId: Number(req.params.clientId),
      nutritionId: Number(req.params.nutritionId),
    });
    await db.delete(nutritionLogsTable)
      .where(and(eq(nutritionLogsTable.id, nutritionId), eq(nutritionLogsTable.clientId, clientId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete nutrition log" });
  }
});

export default router;
