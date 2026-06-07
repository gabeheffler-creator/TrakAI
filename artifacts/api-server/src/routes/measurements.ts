import { Router } from "express";
import { db } from "@workspace/db";
import { measurementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListMeasurementsParams,
  LogMeasurementParams,
  LogMeasurementBody,
  DeleteMeasurementParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/clients/:clientId/measurements", async (req, res) => {
  try {
    const { clientId } = ListMeasurementsParams.parse({ clientId: Number(req.params.clientId) });
    const rows = await db.select().from(measurementsTable)
      .where(eq(measurementsTable.clientId, clientId))
      .orderBy(measurementsTable.date);
    res.json(rows.map(m => ({
      ...m,
      weight: m.weight ? Number(m.weight) : null,
      chest: m.chest ? Number(m.chest) : null,
      waist: m.waist ? Number(m.waist) : null,
      hips: m.hips ? Number(m.hips) : null,
      arms: m.arms ? Number(m.arms) : null,
      thighs: m.thighs ? Number(m.thighs) : null,
      calves: m.calves ? Number(m.calves) : null,
      leftArm: m.leftArm ? Number(m.leftArm) : null,
      rightArm: m.rightArm ? Number(m.rightArm) : null,
      leftThigh: m.leftThigh ? Number(m.leftThigh) : null,
      rightThigh: m.rightThigh ? Number(m.rightThigh) : null,
      leftCalf: m.leftCalf ? Number(m.leftCalf) : null,
      rightCalf: m.rightCalf ? Number(m.rightCalf) : null,
      bodyFat: m.bodyFat ? Number(m.bodyFat) : null,
      createdAt: m.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list measurements" });
  }
});

router.post("/clients/:clientId/measurements", async (req, res) => {
  try {
    const { clientId } = LogMeasurementParams.parse({ clientId: Number(req.params.clientId) });
    const body = LogMeasurementBody.parse(req.body);
    const [m] = await db.insert(measurementsTable).values({
      clientId,
      date: body.date instanceof Date ? body.date.toISOString().split("T")[0] : body.date,
      weight: body.weight != null ? String(body.weight) : null,
      chest: body.chest != null ? String(body.chest) : null,
      waist: body.waist != null ? String(body.waist) : null,
      hips: body.hips != null ? String(body.hips) : null,
      arms: body.arms != null ? String(body.arms) : null,
      thighs: body.thighs != null ? String(body.thighs) : null,
      calves: body.calves != null ? String(body.calves) : null,
      leftArm: body.leftArm != null ? String(body.leftArm) : null,
      rightArm: body.rightArm != null ? String(body.rightArm) : null,
      leftThigh: body.leftThigh != null ? String(body.leftThigh) : null,
      rightThigh: body.rightThigh != null ? String(body.rightThigh) : null,
      leftCalf: body.leftCalf != null ? String(body.leftCalf) : null,
      rightCalf: body.rightCalf != null ? String(body.rightCalf) : null,
      bodyFat: body.bodyFat != null ? String(body.bodyFat) : null,
      unit: body.unit ?? "imperial",
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({
      ...m,
      weight: m.weight ? Number(m.weight) : null,
      chest: m.chest ? Number(m.chest) : null,
      waist: m.waist ? Number(m.waist) : null,
      hips: m.hips ? Number(m.hips) : null,
      arms: m.arms ? Number(m.arms) : null,
      thighs: m.thighs ? Number(m.thighs) : null,
      calves: m.calves ? Number(m.calves) : null,
      leftArm: m.leftArm ? Number(m.leftArm) : null,
      rightArm: m.rightArm ? Number(m.rightArm) : null,
      leftThigh: m.leftThigh ? Number(m.leftThigh) : null,
      rightThigh: m.rightThigh ? Number(m.rightThigh) : null,
      leftCalf: m.leftCalf ? Number(m.leftCalf) : null,
      rightCalf: m.rightCalf ? Number(m.rightCalf) : null,
      bodyFat: m.bodyFat ? Number(m.bodyFat) : null,
      createdAt: m.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to log measurement" });
  }
});

router.delete("/clients/:clientId/measurements/:measurementId", async (req, res) => {
  try {
    const { measurementId } = DeleteMeasurementParams.parse({
      clientId: Number(req.params.clientId),
      measurementId: Number(req.params.measurementId),
    });
    await db.delete(measurementsTable).where(eq(measurementsTable.id, measurementId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete measurement" });
  }
});

export default router;
