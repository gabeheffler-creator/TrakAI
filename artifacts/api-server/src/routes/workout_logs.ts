import { Router } from "express";
import { db } from "@workspace/db";
import { workoutLogsTable, setLogsTable, exercisesTable } from "@workspace/db";
import { eq, asc, inArray, and, desc } from "drizzle-orm";
import {
  ListWorkoutLogsParams,
  CreateWorkoutLogParams,
  CreateWorkoutLogBody,
  GetWorkoutLogParams,
  UpdateWorkoutLogParams,
  UpdateWorkoutLogBody,
  LogSetParams,
  LogSetBody,
} from "@workspace/api-zod";
import { requireClientOwnership } from "../middlewares/auth";

const router = Router();

router.get("/clients/:clientId/workout-logs", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = ListWorkoutLogsParams.parse({ clientId: Number(req.params.clientId) });
    const logs = await db.select().from(workoutLogsTable)
      .where(eq(workoutLogsTable.clientId, clientId))
      .orderBy(workoutLogsTable.date);

    const logIds = logs.map(l => l.id);
    const allSets = logIds.length > 0
      ? await db.select().from(setLogsTable)
          .where(inArray(setLogsTable.workoutLogId, logIds))
          .orderBy(asc(setLogsTable.setNumber))
      : [];

    const setsByLog: Record<number, typeof allSets> = {};
    for (const s of allSets) {
      (setsByLog[s.workoutLogId] ??= []).push(s);
    }

    res.json(logs.map(l => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      sets: (setsByLog[l.id] ?? []).map(s => ({
        ...s,
        weight: s.weight ? Number(s.weight) : null,
      })),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list workout logs" });
  }
});

router.post("/clients/:clientId/workout-logs", requireClientOwnership(), async (req, res) => {
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

router.get("/clients/:clientId/workout-logs/last-performance/:programDayId", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const programDayId = Number(req.params.programDayId);
    if (!programDayId) { res.status(400).json({ error: "programDayId is required" }); return; }

    const [log] = await db
      .select({ id: workoutLogsTable.id })
      .from(workoutLogsTable)
      .where(and(
        eq(workoutLogsTable.clientId, clientId),
        eq(workoutLogsTable.programDayId, programDayId),
        eq(workoutLogsTable.status, "completed"),
      ))
      .orderBy(desc(workoutLogsTable.date), desc(workoutLogsTable.id))
      .limit(1);

    if (!log) { res.json([]); return; }

    const sets = await db
      .select()
      .from(setLogsTable)
      .where(eq(setLogsTable.workoutLogId, log.id))
      .orderBy(asc(setLogsTable.setNumber));

    const byExercise: Record<number, typeof sets[0]> = {};
    for (const s of sets) {
      byExercise[s.exerciseId] = s;
    }

    res.json(Object.values(byExercise).map(s => ({
      exerciseId: s.exerciseId,
      reps: s.reps,
      weight: s.weight ? Number(s.weight) : null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get last workout performance" });
  }
});

router.get("/clients/:clientId/workout-logs/:logId", requireClientOwnership(), async (req, res) => {
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

router.patch("/clients/:clientId/workout-logs/:logId", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId, logId } = UpdateWorkoutLogParams.parse({
      clientId: Number(req.params.clientId),
      logId: Number(req.params.logId),
    });
    const body = UpdateWorkoutLogBody.parse(req.body);
    const updates: Record<string, string | null> = {};
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.status !== undefined) updates.status = body.status;
    const [updated] = await db.update(workoutLogsTable)
      .set(updates)
      .where(and(eq(workoutLogsTable.id, logId), eq(workoutLogsTable.clientId, clientId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Log not found" }); return; }
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update workout log" });
  }
});

router.post("/clients/:clientId/workout-logs/:logId/sets", requireClientOwnership(), async (req, res) => {
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
      rpe: body.rpe ?? null,
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
