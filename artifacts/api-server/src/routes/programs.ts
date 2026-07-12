import { Router } from "express";
import { db } from "@workspace/db";
import {
  programsTable,
  programPhasesTable,
  programDaysTable,
  programExercisesTable,
  exercisesTable,
  programAssignmentsTable,
  programNutritionGoalsTable,
  clientsTable,
  pushSubscriptionsTable,
} from "@workspace/db";
import { eq, asc, and, isNull, inArray } from "drizzle-orm";
import webpush from "web-push";
import {
  CreateProgramBody,
  UpdateProgramBody,
  GetProgramParams,
  UpdateProgramParams,
  DeleteProgramParams,
  CreateProgramPhaseBody,
  CreateProgramPhaseParams,
  UpdateProgramPhaseBody,
  UpdateProgramPhaseParams,
  DeleteProgramPhaseParams,
  CreateProgramDayBody,
  CreateProgramDayParams,
  UpdateProgramDayParams,
  UpdateProgramDayBody,
  DeleteProgramDayParams,
  AddExerciseToDayParams,
  AddExerciseToDayBody,
  UpdateProgramExerciseParams,
  UpdateProgramExerciseBody,
  DeleteProgramExerciseParams,
  GetClientProgramAssignmentParams,
  AssignProgramParams,
  AssignProgramBody,
  SyncProgramFromTemplateParams,
  GetProgramAssignedClientsParams,
  BulkAssignProgramParams,
  BulkAssignProgramBody,
  SyncProgramToClientsParams,
  SyncProgramToClientsBody,
  SetPhaseNutritionGoalParams,
  SetPhaseNutritionGoalBody,
  SetDayNutritionGoalParams,
  SetDayNutritionGoalBody,
  DeleteDayNutritionGoalParams,
} from "@workspace/api-zod";
import { requireCoachAuth, requireClientOwnership, requireCoachOnly } from "../middlewares/auth";
import { cloneProgram, type DbOrTx } from "../services/clone-program";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? "mailto:admin@trakcoach.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

async function sendProgramUpdatePush(clientId: number, programName: string, log: any) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client || client.status === "inactive") return;
  const subs = await db.select().from(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.role, "client"), eq(pushSubscriptionsTable.clientId, clientId)));
  const payload = JSON.stringify({
    title: "Program updated",
    body: `Your coach has updated your program: ${programName}`,
    tag: `program-${clientId}`,
    url: "/client/program",
  });
  for (const sub of subs) {
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    ).catch((err: any) => {
      if (err.statusCode === 410) {
        db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, sub.endpoint)).catch(() => {});
      } else {
        log.warn({ err }, "Push send failed");
      }
    });
  }
}

const router = Router();

function coachIdOf(req: import("express").Request): number {
  const actor = req.actor;
  return actor?.type === "coach" ? actor.coach.id : -1;
}

async function programBelongsToCoach(programId: number, coachId: number): Promise<boolean> {
  const [program] = await db.select({ coachId: programsTable.coachId }).from(programsTable).where(eq(programsTable.id, programId));
  return !!program && program.coachId === coachId;
}

async function phaseBelongsToCoach(phaseId: number, coachId: number): Promise<boolean> {
  const [row] = await db.select({ coachId: programsTable.coachId })
    .from(programPhasesTable)
    .innerJoin(programsTable, eq(programPhasesTable.programId, programsTable.id))
    .where(eq(programPhasesTable.id, phaseId));
  return !!row && row.coachId === coachId;
}

async function dayBelongsToCoach(dayId: number, coachId: number): Promise<boolean> {
  const [row] = await db.select({ coachId: programsTable.coachId })
    .from(programDaysTable)
    .innerJoin(programsTable, eq(programDaysTable.programId, programsTable.id))
    .where(eq(programDaysTable.id, dayId));
  return !!row && row.coachId === coachId;
}

async function programExerciseBelongsToCoach(peId: number, coachId: number): Promise<boolean> {
  const [row] = await db.select({ coachId: programsTable.coachId })
    .from(programExercisesTable)
    .innerJoin(programDaysTable, eq(programExercisesTable.dayId, programDaysTable.id))
    .innerJoin(programsTable, eq(programDaysTable.programId, programsTable.id))
    .where(eq(programExercisesTable.id, peId));
  return !!row && row.coachId === coachId;
}

// ── Programs ──────────────────────────────────────────────────────────────

router.get("/programs", requireCoachAuth, async (req, res) => {
  try {
    const programs = await db.select().from(programsTable)
      .where(and(eq(programsTable.coachId, coachIdOf(req)), isNull(programsTable.clientId)))
      .orderBy(programsTable.createdAt);
    res.json(programs.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list programs" });
  }
});

router.post("/programs", requireCoachAuth, async (req, res) => {
  try {
    const body = CreateProgramBody.parse(req.body);
    const [program] = await db.insert(programsTable).values({
      coachId: coachIdOf(req),
      name: body.name,
      description: body.description ?? null,
      durationWeeks: body.durationWeeks ?? null,
    }).returning();
    res.status(201).json({ ...program, createdAt: program.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create program" });
  }
});

router.get("/programs/:programId", requireCoachAuth, async (req, res) => {
  try {
    const { programId } = GetProgramParams.parse({ programId: Number(req.params.programId) });
    const [program] = await db.select().from(programsTable).where(eq(programsTable.id, programId));
    if (!program || program.coachId !== coachIdOf(req)) { res.status(404).json({ error: "Program not found" }); return; }

    const phases = await db.select().from(programPhasesTable)
      .where(eq(programPhasesTable.programId, programId))
      .orderBy(asc(programPhasesTable.order));

    const days = await db.select().from(programDaysTable)
      .where(eq(programDaysTable.programId, programId))
      .orderBy(asc(programDaysTable.dayNumber));

    const dayIds = days.map(d => d.id);
    let allExercises: any[] = [];
    if (dayIds.length > 0) {
      allExercises = await db
        .select({
          id: programExercisesTable.id,
          dayId: programExercisesTable.dayId,
          exerciseId: programExercisesTable.exerciseId,
          exerciseName: exercisesTable.name,
          muscleGroup: exercisesTable.muscleGroup,
          sets: programExercisesTable.sets,
          reps: programExercisesTable.reps,
          order: programExercisesTable.order,
          weight: programExercisesTable.weight,
          notes: programExercisesTable.notes,
          restSeconds: programExercisesTable.restSeconds,
        })
        .from(programExercisesTable)
        .innerJoin(exercisesTable, eq(programExercisesTable.exerciseId, exercisesTable.id))
        .orderBy(asc(programExercisesTable.order));
    }

    const phaseIds = phases.map(p => p.id);
    let nutritionGoals: (typeof programNutritionGoalsTable.$inferSelect)[] = [];
    if (phaseIds.length > 0) {
      nutritionGoals = await db.select().from(programNutritionGoalsTable)
        .where(inArray(programNutritionGoalsTable.phaseId, phaseIds));
    }

    const daysWithExercises = days.map(d => ({
      ...d,
      exercises: allExercises.filter(e => e.dayId === d.id),
      nutritionGoalOverride: nutritionGoals.find(g => g.phaseId === d.phaseId && g.dayId === d.id),
    }));

    const detail = {
      ...program,
      createdAt: program.createdAt.toISOString(),
      phases: phases.map(ph => ({
        ...ph,
        nutritionGoal: nutritionGoals.find(g => g.phaseId === ph.id && g.dayId === null),
        days: daysWithExercises.filter(d => d.phaseId === ph.id),
      })),
      days: daysWithExercises,
    };
    res.json(detail);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get program" });
  }
});

router.patch("/programs/:programId", requireCoachAuth, async (req, res) => {
  try {
    const { programId } = UpdateProgramParams.parse({ programId: Number(req.params.programId) });
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) { res.status(404).json({ error: "Program not found" }); return; }
    const body = UpdateProgramBody.parse(req.body);
    const [program] = await db.update(programsTable).set({
      name: body.name,
      description: body.description ?? undefined,
      durationWeeks: body.durationWeeks ?? undefined,
    }).where(eq(programsTable.id, programId)).returning();
    if (!program) { res.status(404).json({ error: "Program not found" }); return; }
    res.json({ ...program, createdAt: program.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update program" });
  }
});

router.delete("/programs/:programId", requireCoachAuth, async (req, res) => {
  try {
    const { programId } = DeleteProgramParams.parse({ programId: Number(req.params.programId) });
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) { res.status(404).json({ error: "Program not found" }); return; }
    await db.delete(programsTable).where(eq(programsTable.id, programId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete program" });
  }
});

// ── Program Phases ────────────────────────────────────────────────────────

router.post("/programs/:programId/phases", requireCoachAuth, async (req, res) => {
  try {
    const { programId } = CreateProgramPhaseParams.parse({ programId: Number(req.params.programId) });
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) { res.status(404).json({ error: "Program not found" }); return; }
    const body = CreateProgramPhaseBody.parse(req.body);
    const existing = await db.select().from(programPhasesTable)
      .where(eq(programPhasesTable.programId, programId))
      .orderBy(asc(programPhasesTable.order));
    const nextOrder = body.order ?? existing.length;
    const [phase] = await db.insert(programPhasesTable).values({
      programId,
      name: body.name,
      order: nextOrder,
      durationWeeks: body.durationWeeks,
      daysPerWeek: body.daysPerWeek ?? null,
    }).returning();
    res.status(201).json(phase);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create phase" });
  }
});

router.patch("/programs/:programId/phases/:phaseId", requireCoachAuth, async (req, res) => {
  try {
    const { phaseId } = UpdateProgramPhaseParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
    });
    if (!(await phaseBelongsToCoach(phaseId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
    const body = UpdateProgramPhaseBody.parse(req.body);
    const [phase] = await db.update(programPhasesTable).set({
      name: body.name,
      durationWeeks: body.durationWeeks ?? undefined,
      daysPerWeek: body.daysPerWeek !== undefined ? body.daysPerWeek : undefined,
      order: body.order ?? undefined,
    }).where(eq(programPhasesTable.id, phaseId)).returning();
    if (!phase) { res.status(404).json({ error: "Phase not found" }); return; }
    res.json(phase);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update phase" });
  }
});

router.delete("/programs/:programId/phases/:phaseId", requireCoachAuth, async (req, res) => {
  try {
    const { phaseId } = DeleteProgramPhaseParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
    });
    if (!(await phaseBelongsToCoach(phaseId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
    await db.delete(programPhasesTable).where(eq(programPhasesTable.id, phaseId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete phase" });
  }
});

// ── Program Nutrition Goals ───────────────────────────────────────────────

router.put("/programs/:programId/phases/:phaseId/nutrition-goal", requireCoachAuth, async (req, res) => {
  try {
    const { phaseId } = SetPhaseNutritionGoalParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
    });
    if (!(await phaseBelongsToCoach(phaseId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
    const body = SetPhaseNutritionGoalBody.parse(req.body);
    const [existing] = await db.select().from(programNutritionGoalsTable)
      .where(and(eq(programNutritionGoalsTable.phaseId, phaseId), isNull(programNutritionGoalsTable.dayId)));
    let goal;
    if (existing) {
      [goal] = await db.update(programNutritionGoalsTable).set({
        calories: body.calories ?? null,
        protein: body.protein ?? null,
        carbs: body.carbs ?? null,
        fat: body.fat ?? null,
      }).where(eq(programNutritionGoalsTable.id, existing.id)).returning();
    } else {
      [goal] = await db.insert(programNutritionGoalsTable).values({
        phaseId,
        dayId: null,
        calories: body.calories ?? null,
        protein: body.protein ?? null,
        carbs: body.carbs ?? null,
        fat: body.fat ?? null,
      }).returning();
    }
    res.json(goal);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to set phase nutrition goal" });
  }
});

router.put("/programs/:programId/phases/:phaseId/days/:dayId/nutrition-goal", requireCoachAuth, async (req, res) => {
  try {
    const { phaseId, dayId } = SetDayNutritionGoalParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
      dayId: Number(req.params.dayId),
    });
    if (!(await phaseBelongsToCoach(phaseId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
    if (!(await dayBelongsToCoach(dayId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found" }); return; }
    const body = SetDayNutritionGoalBody.parse(req.body);
    const [existing] = await db.select().from(programNutritionGoalsTable)
      .where(and(eq(programNutritionGoalsTable.phaseId, phaseId), eq(programNutritionGoalsTable.dayId, dayId)));
    let goal;
    if (existing) {
      [goal] = await db.update(programNutritionGoalsTable).set({
        calories: body.calories ?? null,
        protein: body.protein ?? null,
        carbs: body.carbs ?? null,
        fat: body.fat ?? null,
      }).where(eq(programNutritionGoalsTable.id, existing.id)).returning();
    } else {
      [goal] = await db.insert(programNutritionGoalsTable).values({
        phaseId,
        dayId,
        calories: body.calories ?? null,
        protein: body.protein ?? null,
        carbs: body.carbs ?? null,
        fat: body.fat ?? null,
      }).returning();
    }
    res.json(goal);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to set day nutrition goal" });
  }
});

router.delete("/programs/:programId/phases/:phaseId/days/:dayId/nutrition-goal", requireCoachAuth, async (req, res) => {
  try {
    const { phaseId, dayId } = DeleteDayNutritionGoalParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
      dayId: Number(req.params.dayId),
    });
    if (!(await phaseBelongsToCoach(phaseId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
    await db.delete(programNutritionGoalsTable)
      .where(and(eq(programNutritionGoalsTable.phaseId, phaseId), eq(programNutritionGoalsTable.dayId, dayId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete day nutrition goal" });
  }
});

// ── Program Days ──────────────────────────────────────────────────────────

router.post("/programs/:programId/days", requireCoachAuth, async (req, res) => {
  try {
    const { programId } = CreateProgramDayParams.parse({ programId: Number(req.params.programId) });
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) { res.status(404).json({ error: "Program not found" }); return; }
    const body = CreateProgramDayBody.parse(req.body);
    if (!body.phaseId) {
      res.status(400).json({ error: "phaseId is required — days must belong to a phase" });
      return;
    }
    if (!(await phaseBelongsToCoach(body.phaseId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
    const [day] = await db.insert(programDaysTable).values({
      programId,
      phaseId: body.phaseId,
      dayNumber: body.dayNumber,
      name: body.name,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json(day);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create day" });
  }
});

router.patch("/programs/:programId/days/:dayId", requireCoachAuth, async (req, res) => {
  try {
    const { dayId } = UpdateProgramDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
    if (!(await dayBelongsToCoach(dayId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found" }); return; }
    const body = UpdateProgramDayBody.parse(req.body);
    const [day] = await db.update(programDaysTable).set({
      dayNumber: body.dayNumber,
      name: body.name,
      notes: body.notes ?? undefined,
      phaseId: body.phaseId ?? undefined,
    }).where(eq(programDaysTable.id, dayId)).returning();
    if (!day) { res.status(404).json({ error: "Day not found" }); return; }
    res.json(day);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update day" });
  }
});

router.delete("/programs/:programId/days/:dayId", requireCoachAuth, async (req, res) => {
  try {
    const { dayId } = DeleteProgramDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
    if (!(await dayBelongsToCoach(dayId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found" }); return; }
    await db.delete(programDaysTable).where(eq(programDaysTable.id, dayId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete day" });
  }
});

// ── Program Exercises ─────────────────────────────────────────────────────

router.post("/programs/:programId/days/:dayId/exercises", requireCoachAuth, async (req, res) => {
  try {
    const { dayId } = AddExerciseToDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
    if (!(await dayBelongsToCoach(dayId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found" }); return; }
    const body = AddExerciseToDayBody.parse(req.body);
    const [pe] = await db.insert(programExercisesTable).values({
      dayId,
      exerciseId: body.exerciseId,
      sets: body.sets,
      reps: body.reps,
      order: body.order,
      weight: body.weight ?? null,
      notes: body.notes ?? null,
      restSeconds: body.restSeconds ?? null,
    }).returning();
    res.status(201).json(pe);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to add exercise" });
  }
});

router.patch("/programs/:programId/days/:dayId/exercises/:peId", requireCoachAuth, async (req, res) => {
  try {
    const { peId } = UpdateProgramExerciseParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
      peId: Number(req.params.peId),
    });
    if (!(await programExerciseBelongsToCoach(peId, coachIdOf(req)))) { res.status(404).json({ error: "Exercise not found" }); return; }
    const body = UpdateProgramExerciseBody.parse(req.body);
    const [pe] = await db.update(programExercisesTable).set({
      sets: body.sets,
      reps: body.reps,
      order: body.order,
      weight: body.weight ?? undefined,
      notes: body.notes ?? undefined,
      restSeconds: body.restSeconds ?? undefined,
    }).where(eq(programExercisesTable.id, peId)).returning();
    if (!pe) { res.status(404).json({ error: "Exercise not found" }); return; }
    res.json(pe);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update exercise" });
  }
});

router.delete("/programs/:programId/days/:dayId/exercises/:peId", requireCoachAuth, async (req, res) => {
  try {
    const { peId } = DeleteProgramExerciseParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
      peId: Number(req.params.peId),
    });
    if (!(await programExerciseBelongsToCoach(peId, coachIdOf(req)))) { res.status(404).json({ error: "Exercise not found" }); return; }
    await db.delete(programExercisesTable).where(eq(programExercisesTable.id, peId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete exercise" });
  }
});

// ── Program Assignments ───────────────────────────────────────────────────

router.get("/clients/:clientId/program-assignment", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = GetClientProgramAssignmentParams.parse({ clientId: Number(req.params.clientId) });
    const [assignment] = await db
      .select({
        id: programAssignmentsTable.id,
        clientId: programAssignmentsTable.clientId,
        programId: programAssignmentsTable.programId,
        programName: programsTable.name,
        startDate: programAssignmentsTable.startDate,
        endDate: programAssignmentsTable.endDate,
      })
      .from(programAssignmentsTable)
      .innerJoin(programsTable, eq(programAssignmentsTable.programId, programsTable.id))
      .where(eq(programAssignmentsTable.clientId, clientId))
      .orderBy(programAssignmentsTable.createdAt);
    if (!assignment) { res.status(404).json({ error: "No active program" }); return; }
    res.json(assignment);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get assignment" });
  }
});

router.post("/clients/:clientId/program-assignment", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = AssignProgramParams.parse({ clientId: Number(req.params.clientId) });
    const body = AssignProgramBody.parse(req.body);
    const toDateStr = (d: Date | string) => d instanceof Date ? d.toISOString().split("T")[0] : d;
    if (!(await programBelongsToCoach(body.programId, coachIdOf(req)))) { res.status(404).json({ error: "Program not found" }); return; }

    const result = await db.transaction(async (tx) => {
      const [existingAssignment] = await tx
        .select()
        .from(programAssignmentsTable)
        .where(eq(programAssignmentsTable.clientId, clientId));

      if (existingAssignment) {
        await tx.delete(programAssignmentsTable).where(eq(programAssignmentsTable.id, existingAssignment.id));
        const [oldProgram] = await tx.select({ id: programsTable.id, clientId: programsTable.clientId })
          .from(programsTable).where(eq(programsTable.id, existingAssignment.programId));
        if (oldProgram?.clientId === clientId) {
          await tx.delete(programsTable).where(eq(programsTable.id, oldProgram.id));
        }
      }

      const clonedProgramId = await cloneProgram(tx, body.programId, coachIdOf(req), clientId);
      const [assignment] = await tx.insert(programAssignmentsTable).values({
        clientId,
        programId: clonedProgramId,
        startDate: toDateStr(body.startDate),
        endDate: body.endDate != null ? toDateStr(body.endDate) : null,
      }).returning();
      const [program] = await tx.select().from(programsTable).where(eq(programsTable.id, clonedProgramId));
      return { assignment, programName: program?.name ?? "" };
    });

    res.status(201).json({ ...result.assignment, programName: result.programName });
    sendProgramUpdatePush(clientId, result.programName, req.log);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to assign program" });
  }
});

class RouteError extends Error {
  constructor(readonly statusCode: number, message: string) { super(message); }
}

router.post("/clients/:clientId/program-assignment/sync-template", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = SyncProgramFromTemplateParams.parse({ clientId: Number(req.params.clientId) });

    const newAssignment = await db.transaction(async (tx) => {
      const [currentAssignment] = await tx
        .select()
        .from(programAssignmentsTable)
        .where(eq(programAssignmentsTable.clientId, clientId));

      if (!currentAssignment) throw new RouteError(404, "No active program assignment");

      const [currentProgram] = await tx
        .select()
        .from(programsTable)
        .where(eq(programsTable.id, currentAssignment.programId));

      if (!currentProgram?.sourceTemplateId) throw new RouteError(400, "Assigned program has no source template");

      if (!(await programBelongsToCoach(currentProgram.sourceTemplateId, coachIdOf(req)))) {
        throw new RouteError(404, "Source template not found");
      }

      await tx.delete(programAssignmentsTable).where(eq(programAssignmentsTable.id, currentAssignment.id));
      if (currentProgram.clientId === clientId) {
        await tx.delete(programsTable).where(eq(programsTable.id, currentProgram.id));
      }

      const clonedProgramId = await cloneProgram(tx, currentProgram.sourceTemplateId, coachIdOf(req), clientId);
      const [inserted] = await tx.insert(programAssignmentsTable).values({
        clientId,
        programId: clonedProgramId,
        startDate: currentAssignment.startDate,
        endDate: currentAssignment.endDate,
      }).returning();
      const [clonedProgram] = await tx.select().from(programsTable).where(eq(programsTable.id, clonedProgramId));

      return { assignment: inserted, programName: clonedProgram?.name ?? "" };
    });

    res.json({ ...newAssignment.assignment, programName: newAssignment.programName });
    sendProgramUpdatePush(clientId, newAssignment.programName, req.log);
  } catch (err) {
    if (err instanceof RouteError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    req.log.error(err);
    res.status(500).json({ error: "Failed to sync program from template" });
  }
});

// GET /programs/:programId/assigned-clients — list clients whose program was cloned from this template
router.get("/programs/:programId/assigned-clients", requireCoachAuth, async (req, res) => {
  try {
    const { programId } = GetProgramAssignedClientsParams.parse({ programId: Number(req.params.programId) });
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Program not found" });
      return;
    }
    const rows = await db
      .select({
        clientId: programsTable.clientId,
        clientName: clientsTable.name,
        assignedAt: programAssignmentsTable.createdAt,
      })
      .from(programsTable)
      .innerJoin(clientsTable, eq(programsTable.clientId, clientsTable.id))
      .innerJoin(programAssignmentsTable, eq(programAssignmentsTable.clientId, programsTable.clientId))
      .where(eq(programsTable.sourceTemplateId, programId))
      .orderBy(asc(clientsTable.name));
    res.json(rows.map(r => ({
      clientId: r.clientId,
      clientName: r.clientName,
      assignedAt: r.assignedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get assigned clients" });
  }
});

// POST /programs/:programId/bulk-assign — clone template to multiple clients at once
router.post("/programs/:programId/bulk-assign", requireCoachAuth, requireCoachOnly, async (req, res) => {
  try {
    const { programId } = BulkAssignProgramParams.parse({ programId: Number(req.params.programId) });
    const body = BulkAssignProgramBody.parse(req.body);
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Program not found" });
      return;
    }

    // Find which clientIds already have this program as their source template
    const alreadyAssigned = await db
      .select({ clientId: programsTable.clientId })
      .from(programsTable)
      .where(eq(programsTable.sourceTemplateId, programId));
    const alreadyAssignedIds = new Set(alreadyAssigned.map(r => r.clientId).filter((id): id is number => id !== null));

    const toAssign = body.clientIds.filter(id => !alreadyAssignedIds.has(id));
    const skipped = body.clientIds.filter(id => alreadyAssignedIds.has(id));
    const assigned: number[] = [];

    const toDateStr = (d: Date) => d.toISOString().split("T")[0];

    for (const clientId of toAssign) {
      try {
        const programName = await db.transaction(async (tx) => {
          // Remove any existing assignment first
          const [existingAssignment] = await tx.select().from(programAssignmentsTable).where(eq(programAssignmentsTable.clientId, clientId));
          if (existingAssignment) {
            await tx.delete(programAssignmentsTable).where(eq(programAssignmentsTable.id, existingAssignment.id));
            const [oldProgram] = await tx.select({ id: programsTable.id, clientId: programsTable.clientId }).from(programsTable).where(eq(programsTable.id, existingAssignment.programId));
            if (oldProgram?.clientId === clientId) {
              await tx.delete(programsTable).where(eq(programsTable.id, oldProgram.id));
            }
          }
          const clonedProgramId = await cloneProgram(tx, programId, coachIdOf(req), clientId);
          const startDate = toDateStr(new Date());
          await tx.insert(programAssignmentsTable).values({ clientId, programId: clonedProgramId, startDate });
          const [prog] = await tx.select().from(programsTable).where(eq(programsTable.id, clonedProgramId));
          return prog?.name ?? "";
        });
        assigned.push(clientId);
        sendProgramUpdatePush(clientId, programName, req.log);
      } catch (innerErr) {
        req.log.error({ clientId, err: innerErr }, "Failed to assign program to client");
      }
    }

    res.json({ assigned, skipped });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to bulk assign program" });
  }
});

// POST /programs/:programId/sync-to-clients — push current template state to selected clients
router.post("/programs/:programId/sync-to-clients", requireCoachAuth, requireCoachOnly, async (req, res) => {
  try {
    const { programId } = SyncProgramToClientsParams.parse({ programId: Number(req.params.programId) });
    const body = SyncProgramToClientsBody.parse(req.body);
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Program not found" });
      return;
    }

    const synced: number[] = [];

    for (const clientId of body.clientIds) {
      try {
        const programName = await db.transaction(async (tx) => {
          const [currentAssignment] = await tx.select().from(programAssignmentsTable).where(eq(programAssignmentsTable.clientId, clientId));
          if (!currentAssignment) return null;
          const [currentProgram] = await tx.select().from(programsTable).where(eq(programsTable.id, currentAssignment.programId));
          if (!currentProgram?.sourceTemplateId) return null;

          await tx.delete(programAssignmentsTable).where(eq(programAssignmentsTable.id, currentAssignment.id));
          if (currentProgram.clientId === clientId) {
            await tx.delete(programsTable).where(eq(programsTable.id, currentProgram.id));
          }

          const clonedProgramId = await cloneProgram(tx, programId, coachIdOf(req), clientId);
          await tx.insert(programAssignmentsTable).values({
            clientId,
            programId: clonedProgramId,
            startDate: currentAssignment.startDate,
            endDate: currentAssignment.endDate,
          });
          const [prog] = await tx.select().from(programsTable).where(eq(programsTable.id, clonedProgramId));
          return prog?.name ?? "";
        });
        if (programName !== null) {
          synced.push(clientId);
          if (programName) sendProgramUpdatePush(clientId, programName, req.log);
        }
      } catch (innerErr) {
        req.log.error({ clientId, err: innerErr }, "Failed to sync program to client");
      }
    }

    res.json({ synced });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to sync program to clients" });
  }
});

export default router;
