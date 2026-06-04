import { Router } from "express";
import { db } from "@workspace/db";
import { workoutLogsTable, setLogsTable, exercisesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  ListWorkoutLogsParams,
  CreateWorkoutLogParams,
  CreateWorkoutLogBody,
  GetWorkoutLogParams,
  LogSetParams,
  LogSetBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/clients/:clientId/workout-logs", async (req, res) => {
  try {
    const { clientId } = ListWorkoutLogsParams.parse({ clientId: Number(req.params.clientId) });
    const logs = await db.select().from(workoutLogsTable)
      .where(eq(workoutLogsTable.clientId, clientId))
      .orderBy(workoutLogsTable.date);
    res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list workout logs" });
  }
});

router.post("/clients/:clientId/workout-logs", async (req, res) => {
  try {
    const { clientId } = CreateWorkoutLogParams.parse({ clientId: Number(req.params.clientId) });
    const body = CreateWorkoutLogBody.parse(req.body);
    const [log] = await db.insert(workoutLogsTable).values({
      clientId,
      programDayId: body.programDayId ?? null,
      date: body.date instanceof Date ? body.date.toISOString().split("T")[0] : body.date,
      durationMinutes: body.durationMinutes ?? null,
      notes: body.notes ?? null,
      status: "completed",
    }).returning();
    res.status(201).json({ ...log, createdAt: log.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create workout log" });
  }
});

router.get("/clients/:clientId/workout-logs/:logId", async (req, res) => {
  try {
    const { clientId, logId } = GetWorkoutLogParams.parse({
      clientId: Number(req.params.clientId),
      logId: Number(req.params.logId),
    });
    const [log] = await db.select().from(workoutLogsTable)
      .where(eq(workoutLogsTable.id, logId));
    if (!log) { res.status(404).json({ error: "Log not found" }); return; }

    const sets = await db
      .select({
        id: setLogsTable.id,
        workoutLogId: setLogsTable.workoutLogId,
        exerciseId: setLogsTable.exerciseId,
        exerciseName: setLogsTable.exerciseName,
        setNumber: setLogsTable.setNumber,
        reps: setLogsTable.reps,
        weight: setLogsTable.weight,
        weightUnit: setLogsTable.weightUnit,
        notes: setLogsTable.notes,
      })
      .from(setLogsTable)
      .where(eq(setLogsTable.workoutLogId, logId))
      .orderBy(asc(setLogsTable.setNumber));

    res.json({
      ...log,
      createdAt: log.createdAt.toISOString(),
      sets: sets.map(s => ({
        ...s,
        weight: s.weight ? Number(s.weight) : null,
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get workout log" });
  }
});

router.post("/clients/:clientId/workout-logs/:logId/sets", async (req, res) => {
  try {
    const { logId } = LogSetParams.parse({
      clientId: Number(req.params.clientId),
      logId: Number(req.params.logId),
    });
    const body = LogSetBody.parse(req.body);

    const [exercise] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, body.exerciseId));
    const [set] = await db.insert(setLogsTable).values({
      workoutLogId: logId,
      exerciseId: body.exerciseId,
      exerciseName: exercise?.name ?? "Unknown",
      setNumber: body.setNumber,
      reps: body.reps,
      weight: body.weight != null ? String(body.weight) : null,
      weightUnit: body.weightUnit ?? null,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json({
      ...set,
      weight: set.weight ? Number(set.weight) : null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to log set" });
  }
});

export default router;
