import { Router } from "express";
import { db } from "@workspace/db";
import {
  programsTable,
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

const router = Router();

// ── Programs ──────────────────────────────────────────────────────────────

router.get("/programs", async (req, res) => {
  try {
    const programs = await db.select().from(programsTable).orderBy(programsTable.createdAt);
    res.json(programs.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list programs" });
  }
});

router.post("/programs", async (req, res) => {
  try {
    const body = CreateProgramBody.parse(req.body);
    const [program] = await db.insert(programsTable).values({
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

router.get("/programs/:programId", async (req, res) => {
  try {
    const { programId } = GetProgramParams.parse({ programId: Number(req.params.programId) });
    const [program] = await db.select().from(programsTable).where(eq(programsTable.id, programId));
    if (!program) { res.status(404).json({ error: "Program not found" }); return; }

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

    const detail = {
      ...program,
      createdAt: program.createdAt.toISOString(),
      days: days.map(d => ({
        ...d,
        exercises: allExercises.filter(e => e.dayId === d.id),
      })),
    };
    res.json(detail);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get program" });
  }
});

router.patch("/programs/:programId", async (req, res) => {
  try {
    const { programId } = UpdateProgramParams.parse({ programId: Number(req.params.programId) });
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

router.delete("/programs/:programId", async (req, res) => {
  try {
    const { programId } = DeleteProgramParams.parse({ programId: Number(req.params.programId) });
    await db.delete(programsTable).where(eq(programsTable.id, programId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete program" });
  }
});

// ── Program Days ──────────────────────────────────────────────────────────

router.post("/programs/:programId/days", async (req, res) => {
  try {
    const { programId } = CreateProgramDayParams.parse({ programId: Number(req.params.programId) });
    const body = CreateProgramDayBody.parse(req.body);
    const [day] = await db.insert(programDaysTable).values({
      programId,
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

router.patch("/programs/:programId/days/:dayId", async (req, res) => {
  try {
    const { dayId } = UpdateProgramDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
    const body = UpdateProgramDayBody.parse(req.body);
    const [day] = await db.update(programDaysTable).set({
      dayNumber: body.dayNumber,
      name: body.name,
      notes: body.notes ?? undefined,
    }).where(eq(programDaysTable.id, dayId)).returning();
    if (!day) { res.status(404).json({ error: "Day not found" }); return; }
    res.json(day);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update day" });
  }
});

router.delete("/programs/:programId/days/:dayId", async (req, res) => {
  try {
    const { dayId } = DeleteProgramDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
    await db.delete(programDaysTable).where(eq(programDaysTable.id, dayId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete day" });
  }
});

// ── Program Exercises ─────────────────────────────────────────────────────

router.post("/programs/:programId/days/:dayId/exercises", async (req, res) => {
  try {
    const { dayId } = AddExerciseToDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
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

router.patch("/programs/:programId/days/:dayId/exercises/:peId", async (req, res) => {
  try {
    const { peId } = UpdateProgramExerciseParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
      peId: Number(req.params.peId),
    });
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

router.delete("/programs/:programId/days/:dayId/exercises/:peId", async (req, res) => {
  try {
    const { peId } = DeleteProgramExerciseParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
      peId: Number(req.params.peId),
    });
    await db.delete(programExercisesTable).where(eq(programExercisesTable.id, peId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete exercise" });
  }
});

// ── Program Assignments ───────────────────────────────────────────────────

router.get("/clients/:clientId/program-assignment", async (req, res) => {
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

router.post("/clients/:clientId/program-assignment", async (req, res) => {
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
