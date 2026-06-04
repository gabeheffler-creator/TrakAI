import { Router } from "express";
import { db } from "@workspace/db";
import { nutritionLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListNutritionLogsParams,
  CreateNutritionLogParams,
  CreateNutritionLogBody,
  DeleteNutritionLogParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/clients/:clientId/nutrition", async (req, res) => {
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
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list nutrition logs" });
  }
});

router.post("/clients/:clientId/nutrition", async (req, res) => {
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
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({
      ...n,
      protein: n.protein ? Number(n.protein) : null,
      carbs: n.carbs ? Number(n.carbs) : null,
      fat: n.fat ? Number(n.fat) : null,
      createdAt: n.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create nutrition log" });
  }
});

router.delete("/clients/:clientId/nutrition/:nutritionId", async (req, res) => {
  try {
    const { nutritionId } = DeleteNutritionLogParams.parse({
      clientId: Number(req.params.clientId),
      nutritionId: Number(req.params.nutritionId),
    });
    await db.delete(nutritionLogsTable).where(eq(nutritionLogsTable.id, nutritionId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete nutrition log" });
  }
});

export default router;
