import { Router } from "express";
import { db } from "@workspace/db";
import {
  programsTable,
  programPhasesTable,
  programDaysTable,
  programExercisesTable,
  exercisesTable,
  programAssignmentsTable,
  clientsTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
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
} from "@workspace/api-zod";
import { requireCoachAuth, requireClientOwnership, requireCoachOnly } from "../middlewares/auth";

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
      .where(eq(programsTable.coachId, coachIdOf(req)))
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

    const daysWithExercises = days.map(d => ({
      ...d,
      exercises: allExercises.filter(e => e.dayId === d.id),
    }));

    const detail = {
      ...program,
      createdAt: program.createdAt.toISOString(),
      phases: phases.map(ph => ({
        ...ph,
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

// ── Program Days ──────────────────────────────────────────────────────────

router.post("/programs/:programId/days", requireCoachAuth, async (req, res) => {
  try {
    const { programId } = CreateProgramDayParams.parse({ programId: Number(req.params.programId) });
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) { res.status(404).json({ error: "Program not found" }); return; }
    const body = CreateProgramDayBody.parse(req.body);
    const [day] = await db.insert(programDaysTable).values({
      programId,
      phaseId: body.phaseId ?? null,
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
    const [assignment] = await db.insert(programAssignmentsTable).values({
      clientId,
      programId: body.programId,
      startDate: toDateStr(body.startDate),
      endDate: body.endDate != null ? toDateStr(body.endDate) : null,
    }).returning();
    const [program] = await db.select().from(programsTable).where(eq(programsTable.id, assignment.programId));
    res.status(201).json({ ...assignment, programName: program?.name ?? "" });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to assign program" });
  }
});

export default router;
