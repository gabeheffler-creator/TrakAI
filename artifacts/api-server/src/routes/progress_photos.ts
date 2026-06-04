import { Router } from "express";
import { db } from "@workspace/db";
import { progressPhotosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListProgressPhotosParams,
  CreateProgressPhotoParams,
  CreateProgressPhotoBody,
  DeleteProgressPhotoParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/clients/:clientId/photos", async (req, res) => {
  try {
    const { clientId } = ListProgressPhotosParams.parse({ clientId: Number(req.params.clientId) });
    const rows = await db.select().from(progressPhotosTable)
      .where(eq(progressPhotosTable.clientId, clientId))
      .orderBy(progressPhotosTable.date);
    res.json(rows.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list photos" });
  }
});

router.post("/clients/:clientId/photos", async (req, res) => {
  try {
    const { clientId } = CreateProgressPhotoParams.parse({ clientId: Number(req.params.clientId) });
    const body = CreateProgressPhotoBody.parse(req.body);
    const [p] = await db.insert(progressPhotosTable).values({
      clientId,
      date: body.date instanceof Date ? body.date.toISOString().split("T")[0] : body.date,
      imageUrl: body.imageUrl,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({ ...p, createdAt: p.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create photo" });
  }
});

router.delete("/clients/:clientId/photos/:photoId", async (req, res) => {
  try {
    const { photoId } = DeleteProgressPhotoParams.parse({
      clientId: Number(req.params.clientId),
      photoId: Number(req.params.photoId),
    });
    await db.delete(progressPhotosTable).where(eq(progressPhotosTable.id, photoId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

export default router;
