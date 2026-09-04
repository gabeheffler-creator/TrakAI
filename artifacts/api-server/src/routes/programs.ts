import { Router } from "express";
import { db } from "@workspace/db";
import {
  programsTable,
  programPhasesTable,
  programDaysTable,
  programExercisesTable,
  exercisesTable,
  programAssignmentsTable,
  programAssignmentHistoryTable,
  programNutritionGoalsTable,
  programNutritionPeriodsTable,
  clientsTable,
  measurementsTable,
  pushSubscriptionsTable,
} from "@workspace/db";
import { eq, asc, desc, and, isNull, inArray } from "drizzle-orm";
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
  ApproveProgramParams,
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
import { z } from "zod/v4";
import { cloneProgram, type DbOrTx } from "../services/clone-program";
import { actorCaller, requestAiJson, sendAiError } from "../lib/ai-gateway";
import { aiBurstLimit } from "../lib/rate-limit";

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

async function insertProgramHistory(
  tx: DbOrTx,
  clientId: number,
  programId: number,
  startDate: string,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const [prog] = await tx
    .select({ name: programsTable.name, sourceTemplateId: programsTable.sourceTemplateId })
    .from(programsTable)
    .where(eq(programsTable.id, programId));
  if (!prog) return;
  let sourceTemplateName: string | null = null;
  if (prog.sourceTemplateId) {
    const [tmpl] = await tx
      .select({ name: programsTable.name })
      .from(programsTable)
      .where(eq(programsTable.id, prog.sourceTemplateId));
    sourceTemplateName = tmpl?.name ?? null;
  }
  await tx.insert(programAssignmentHistoryTable).values({
    clientId,
    programId,
    programName: prog.name,
    sourceTemplateId: prog.sourceTemplateId,
    sourceTemplateName,
    startDate,
    endDate: today,
  });
}

async function programBelongsToCoach(programId: number, coachId: number): Promise<boolean> {
  const [program] = await db.select({ coachId: programsTable.coachId }).from(programsTable).where(eq(programsTable.id, programId));
  return !!program && program.coachId === coachId;
}

async function approvedProgramBelongsToCoach(programId: number, coachId: number): Promise<boolean> {
  const [program] = await db.select({ id: programsTable.id }).from(programsTable)
    .where(and(
      eq(programsTable.id, programId),
      eq(programsTable.coachId, coachId),
      eq(programsTable.status, "approved"),
    ));
  return !!program;
}

async function phaseBelongsToCoach(phaseId: number, programId: number, coachId: number): Promise<boolean> {
  const [row] = await db.select({ coachId: programsTable.coachId })
    .from(programPhasesTable)
    .innerJoin(programsTable, eq(programPhasesTable.programId, programsTable.id))
    .where(and(eq(programPhasesTable.id, phaseId), eq(programPhasesTable.programId, programId)));
  return !!row && row.coachId === coachId;
}

async function dayBelongsToCoach(dayId: number, programId: number, coachId: number): Promise<boolean> {
  const [row] = await db.select({ coachId: programsTable.coachId })
    .from(programDaysTable)
    .innerJoin(programsTable, eq(programDaysTable.programId, programsTable.id))
    .where(and(eq(programDaysTable.id, dayId), eq(programDaysTable.programId, programId)));
  return !!row && row.coachId === coachId;
}

async function dayBelongsToPhaseAndCoach(dayId: number, phaseId: number, programId: number, coachId: number): Promise<boolean> {
  const [row] = await db.select({ coachId: programsTable.coachId })
    .from(programDaysTable)
    .innerJoin(programsTable, eq(programDaysTable.programId, programsTable.id))
    .where(and(
      eq(programDaysTable.id, dayId),
      eq(programDaysTable.programId, programId),
      eq(programDaysTable.phaseId, phaseId),
    ));
  return !!row && row.coachId === coachId;
}

async function programExerciseBelongsToCoach(peId: number, dayId: number, programId: number, coachId: number): Promise<boolean> {
  const [row] = await db.select({ coachId: programsTable.coachId })
    .from(programExercisesTable)
    .innerJoin(programDaysTable, eq(programExercisesTable.dayId, programDaysTable.id))
    .innerJoin(programsTable, eq(programDaysTable.programId, programsTable.id))
    .where(and(
      eq(programExercisesTable.id, peId),
      eq(programExercisesTable.dayId, dayId),
      eq(programDaysTable.programId, programId),
    ));
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
      status: "draft",
    }).returning();
    res.status(201).json({ ...program, createdAt: program.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create program" });
  }
});

const GenerateAiProgramBody = z.object({
  goalText: z.string().min(1, "goalText is required").max(2000),
  durationWeeks: z.coerce.number().int().positive().max(52).optional(),
  clientId: z.coerce.number().int().positive().optional(),
});

router.post("/programs/generate-ai", requireCoachAuth, aiBurstLimit, async (req, res) => {
  try {
    const parseResult = GenerateAiProgramBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const { goalText, durationWeeks, clientId } = parseResult.data;

    const exercises = await db.select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
      isCompound: exercisesTable.isCompound,
    }).from(exercisesTable);

    if (exercises.length === 0) {
      res.status(400).json({ error: "No exercises in the library. Add exercises before generating a program." });
      return;
    }

    const exerciseMap = new Map(exercises.map(e => [e.id, e]));
    const exerciseCatalog = exercises.map(e => `${e.id}: ${e.name} (${e.muscleGroup ?? "general"}${e.isCompound ? ", compound" : ""})`).join("\n");

    let clientContext = "";
    if (clientId) {
      const [client] = await db.select({
        name: clientsTable.name,
        goal: clientsTable.goal,
      }).from(clientsTable).where(
        and(eq(clientsTable.id, clientId), eq(clientsTable.coachId, coachIdOf(req)))
      );
      if (!client) {
        res.status(404).json({ error: "Client not found" });
        return;
      }
      clientContext = `Client name: ${client.name}\n`;
      if (client.goal) clientContext += `Client's stated goal: ${client.goal}\n`;

      const [latestMeasurement] = await db.select({
        weight: measurementsTable.weight,
        unit: measurementsTable.unit,
      }).from(measurementsTable)
        .where(eq(measurementsTable.clientId, clientId))
        .orderBy(desc(measurementsTable.date))
        .limit(1);
      if (latestMeasurement?.weight) {
        const unitLabel = latestMeasurement.unit === "metric" ? "kg" : "lbs";
        clientContext += `Current weight: ${latestMeasurement.weight} ${unitLabel}\n`;
      }
    }

    const durationHint = durationWeeks
      ? `Program duration: ${durationWeeks} weeks.`
      : "Choose a suitable program duration (4–16 weeks).";

    const userPrompt = `${clientContext}Training goal: ${goalText}
${durationHint}

Available exercises (ID: Name (Muscle Group)):
${exerciseCatalog}

Generate a complete workout program. Use ONLY exercise IDs from the list above. Return ONLY valid JSON with this exact structure:
{
  "name": "Program name",
  "description": "Program description (2-3 sentences)",
  "durationWeeks": 12,
  "days": [
    {
      "dayNumber": 1,
      "name": "Day name",
      "notes": "Coaching notes or null",
      "exercises": [
        { "exerciseId": 5, "sets": 4, "reps": "6-8", "restSeconds": 120 }
      ]
    }
  ]
}

Guidelines:
- 3–5 training days total (not per week, just the day templates)
- 4–7 exercises per day
- Mix compound and isolation movements
- Sensible sets (2–5), reps as a string (e.g. "8-12", "5", "15-20"), rest in seconds (60–180)
- dayNumber starts at 1`;

    type AiDay = { dayNumber: number; name: string; notes?: string | null; exercises: Array<{ exerciseId: number; sets: number; reps: string; restSeconds?: number }> };
    type AiProgram = { name?: string; description?: string; durationWeeks?: number; days?: AiDay[] };
    const parsed = await requestAiJson<AiProgram>({
      caller: actorCaller(req.actor),
      feature: "program_generation",
      maxCompletionTokens: 4096,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an expert personal trainer and strength coach who designs evidence-based workout programs. Return only valid JSON, no markdown fences.",
        },
        { role: "user", content: userPrompt },
      ],
      parse: (content) => {
        const result = JSON.parse(content.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "").trim()) as AiProgram;
        if (!result.name || !Array.isArray(result.days) || result.days.length === 0) throw new Error("Incomplete program");
        return result;
      },
    });

    if (!parsed.name || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      res.status(502).json({ error: "AI returned an incomplete program. Please try again.", code: "AI_INVALID_RESPONSE" });
      return;
    }

    type CreatedDayDetail = {
      id: number; programId: number; dayNumber: number; name: string; notes: string | null; phaseId: null;
      exercises: Array<{ id: number; dayId: number; exerciseId: number; exerciseName: string; muscleGroup: string | null; sets: number; reps: string; order: number; weight: string | null; notes: string | null; restSeconds: number | null }>;
      nutritionGoalOverride: undefined;
    };
    const createdDays: CreatedDayDetail[] = [];

    const newProgram = await db.transaction(async (tx) => {
      const [program] = await tx.insert(programsTable).values({
        coachId: coachIdOf(req),
        name: parsed.name!,
        description: parsed.description ?? null,
        durationWeeks: parsed.durationWeeks ?? durationWeeks ?? null,
        status: "draft",
      }).returning();

      for (const day of parsed.days!) {
        const [newDay] = await tx.insert(programDaysTable).values({
          programId: program.id,
          dayNumber: day.dayNumber,
          name: day.name,
          notes: day.notes ?? null,
        }).returning();

        const validExercises = (day.exercises ?? []).filter(e => exerciseMap.has(e.exerciseId));
        const dayExercises: CreatedDayDetail["exercises"] = [];

        if (validExercises.length > 0) {
          const inserted = await tx.insert(programExercisesTable).values(
            validExercises.map((e, idx) => ({
              dayId: newDay.id,
              exerciseId: e.exerciseId,
              sets: e.sets,
              reps: String(e.reps),
              restSeconds: e.restSeconds ?? null,
              order: idx + 1,
            }))
          ).returning();

          for (const ins of inserted) {
            const ex = exerciseMap.get(ins.exerciseId);
            dayExercises.push({
              id: ins.id,
              dayId: ins.dayId,
              exerciseId: ins.exerciseId,
              exerciseName: ex?.name ?? "",
              muscleGroup: ex?.muscleGroup ?? null,
              sets: ins.sets,
              reps: ins.reps,
              order: ins.order,
              weight: ins.weight ?? null,
              notes: ins.notes ?? null,
              restSeconds: ins.restSeconds ?? null,
            });
          }
        }

        createdDays.push({
          id: newDay.id,
          programId: program.id,
          dayNumber: newDay.dayNumber,
          name: newDay.name,
          notes: newDay.notes,
          phaseId: null,
          exercises: dayExercises,
          nutritionGoalOverride: undefined,
        });
      }

      return program;
    });

    res.status(201).json({
      ...newProgram,
      createdAt: newProgram.createdAt.toISOString(),
      phases: [],
      days: createdDays,
    });
  } catch (err) {
    if (sendAiError(res, err)) return;
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate program" });
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
        .where(inArray(programExercisesTable.dayId, dayIds))
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
      description: body.description !== undefined ? body.description : undefined,
      durationWeeks: body.durationWeeks !== undefined ? body.durationWeeks : undefined,
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

router.post("/programs/:programId/approve", requireCoachAuth, requireCoachOnly, async (req, res) => {
  try {
    const { programId } = ApproveProgramParams.parse({ programId: Number(req.params.programId) });
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Program not found" });
      return;
    }
    const [program] = await db.update(programsTable)
      .set({ status: "approved" })
      .where(eq(programsTable.id, programId))
      .returning();
    if (!program) {
      res.status(404).json({ error: "Program not found" });
      return;
    }
    res.json({ ...program, createdAt: program.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to approve program" });
  }
});

const SleepAdjustmentBody = z.object({
  sleepAdjustEnabled: z.boolean(),
  sleepAdjustPercent: z.coerce.number().int().min(0).max(50),
});

router.patch("/programs/:programId/sleep-adjustment", requireCoachAuth, async (req, res) => {
  try {
    const programId = Number(req.params.programId);
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) { res.status(404).json({ error: "Program not found" }); return; }
    const body = SleepAdjustmentBody.parse(req.body);
    const [program] = await db.update(programsTable)
      .set({ sleepAdjustEnabled: body.sleepAdjustEnabled, sleepAdjustPercent: body.sleepAdjustPercent })
      .where(eq(programsTable.id, programId))
      .returning();
    if (!program) { res.status(404).json({ error: "Program not found" }); return; }
    res.json({ ...program, createdAt: program.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update sleep adjustment settings" });
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
    const { programId, phaseId } = UpdateProgramPhaseParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
    });
    if (!(await phaseBelongsToCoach(phaseId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
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
    const { programId, phaseId } = DeleteProgramPhaseParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
    });
    if (!(await phaseBelongsToCoach(phaseId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
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
    const { programId, phaseId } = SetPhaseNutritionGoalParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
    });
    if (!(await phaseBelongsToCoach(phaseId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
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
    const { programId, phaseId, dayId } = SetDayNutritionGoalParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
      dayId: Number(req.params.dayId),
    });
    if (!(await phaseBelongsToCoach(phaseId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
    if (!(await dayBelongsToPhaseAndCoach(dayId, phaseId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found in phase" }); return; }
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
    const { programId, phaseId, dayId } = DeleteDayNutritionGoalParams.parse({
      programId: Number(req.params.programId),
      phaseId: Number(req.params.phaseId),
      dayId: Number(req.params.dayId),
    });
    if (!(await phaseBelongsToCoach(phaseId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Phase not found" }); return; }
    if (!(await dayBelongsToPhaseAndCoach(dayId, phaseId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found in phase" }); return; }
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
    if (body.phaseId !== undefined) {
      const [phase] = await db.select({ id: programPhasesTable.id })
        .from(programPhasesTable)
        .where(and(eq(programPhasesTable.id, body.phaseId), eq(programPhasesTable.programId, programId)));
      if (!phase) { res.status(404).json({ error: "Phase not found" }); return; }
    }
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
    const { programId, dayId } = UpdateProgramDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
    if (!(await dayBelongsToCoach(dayId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found" }); return; }
    const body = UpdateProgramDayBody.parse(req.body);
    if (body.phaseId !== undefined && body.phaseId !== null) {
      const [phase] = await db.select({ id: programPhasesTable.id })
        .from(programPhasesTable)
        .where(and(
          eq(programPhasesTable.id, body.phaseId),
          eq(programPhasesTable.programId, programId),
        ));
      if (!phase) { res.status(400).json({ error: "Phase must belong to this program" }); return; }
    }
    const [day] = await db.update(programDaysTable).set({
      dayNumber: body.dayNumber,
      name: body.name,
      notes: body.notes !== undefined ? body.notes : undefined,
      phaseId: body.phaseId !== undefined ? body.phaseId : undefined,
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
    const { programId, dayId } = DeleteProgramDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
    if (!(await dayBelongsToCoach(dayId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found" }); return; }
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
    const { programId, dayId } = AddExerciseToDayParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
    });
    if (!(await dayBelongsToCoach(dayId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Day not found" }); return; }
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
    const { programId, dayId, peId } = UpdateProgramExerciseParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
      peId: Number(req.params.peId),
    });
    if (!(await programExerciseBelongsToCoach(peId, dayId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Exercise not found" }); return; }
    const body = UpdateProgramExerciseBody.parse(req.body);
    const [pe] = await db.update(programExercisesTable).set({
      exerciseId: body.exerciseId,
      sets: body.sets,
      reps: body.reps,
      order: body.order,
      weight: body.weight !== undefined ? body.weight : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
      restSeconds: body.restSeconds !== undefined ? body.restSeconds : undefined,
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
    const { programId, dayId, peId } = DeleteProgramExerciseParams.parse({
      programId: Number(req.params.programId),
      dayId: Number(req.params.dayId),
      peId: Number(req.params.peId),
    });
    if (!(await programExerciseBelongsToCoach(peId, dayId, programId, coachIdOf(req)))) { res.status(404).json({ error: "Exercise not found" }); return; }
    await db.delete(programExercisesTable).where(eq(programExercisesTable.id, peId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete exercise" });
  }
});

// ── Client Program (full detail, accessible by client session) ────────────

router.get("/clients/:clientId/program", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);

    const [assignment] = await db
      .select({ programId: programAssignmentsTable.programId })
      .from(programAssignmentsTable)
      .where(eq(programAssignmentsTable.clientId, clientId))
      .orderBy(programAssignmentsTable.createdAt);
    if (!assignment) { res.status(404).json({ error: "No active program" }); return; }

    const programId = assignment.programId;
    const [program] = await db.select().from(programsTable).where(and(
      eq(programsTable.id, programId),
      ...(req.actor?.type === "client" ? [eq(programsTable.status, "approved")] : []),
    ));
    if (!program) { res.status(404).json({ error: "Program not found" }); return; }

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
        .where(inArray(programExercisesTable.dayId, dayIds))
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
      .where(and(
        eq(programAssignmentsTable.clientId, clientId),
        ...(req.actor?.type === "client" ? [eq(programsTable.status, "approved")] : []),
      ))
      .orderBy(programAssignmentsTable.createdAt);
    if (!assignment) { res.status(404).json({ error: "No active program" }); return; }
    res.json(assignment);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get assignment" });
  }
});

router.get("/clients/:clientId/program-assignment-history", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const rows = await db
      .select()
      .from(programAssignmentHistoryTable)
      .where(eq(programAssignmentHistoryTable.clientId, clientId))
      .orderBy(desc(programAssignmentHistoryTable.endDate), desc(programAssignmentHistoryTable.createdAt));

    const toWeeks = (start: string, end: string | null): number | null => {
      if (!end) return null;
      const days = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
      return Math.max(1, Math.round(days / 7));
    };

    res.json(rows.map(r => ({
      id: r.id,
      clientId: r.clientId,
      programId: r.programId,
      programName: r.programName,
      sourceTemplateId: r.sourceTemplateId,
      sourceTemplateName: r.sourceTemplateName,
      startDate: r.startDate,
      endDate: r.endDate,
      durationWeeks: toWeeks(r.startDate, r.endDate),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get program history" });
  }
});

router.post("/clients/:clientId/program-assignment", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = AssignProgramParams.parse({ clientId: Number(req.params.clientId) });
    const body = AssignProgramBody.parse(req.body);
    const toDateStr = (d: Date | string) => d instanceof Date ? d.toISOString().split("T")[0] : d;
    if (!(await approvedProgramBelongsToCoach(body.programId, coachIdOf(req)))) { res.status(404).json({ error: "Approved program not found" }); return; }

    const result = await db.transaction(async (tx) => {
      const [existingAssignment] = await tx
        .select()
        .from(programAssignmentsTable)
        .where(eq(programAssignmentsTable.clientId, clientId));

      if (existingAssignment) {
        await insertProgramHistory(tx, clientId, existingAssignment.programId, existingAssignment.startDate);
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

      if (!(await approvedProgramBelongsToCoach(currentProgram.sourceTemplateId, coachIdOf(req)))) {
        throw new RouteError(404, "Approved source template not found");
      }

      await insertProgramHistory(tx, clientId, currentProgram.id, currentAssignment.startDate);
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
    if (!(await approvedProgramBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Approved program not found" });
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
      .innerJoin(programAssignmentsTable, eq(programAssignmentsTable.programId, programsTable.id))
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
    if (!(await approvedProgramBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Approved program not found" });
      return;
    }

    // Verify all requested clientIds belong to this coach (prevent cross-tenant mutation)
    const coachClients = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.coachId, coachIdOf(req)));
    const coachClientIdSet = new Set(coachClients.map(c => c.id));
    const authorizedIds = body.clientIds.filter(id => coachClientIdSet.has(id));

    // Find which authorized clientIds already have this program as their source template
    const alreadyAssigned = authorizedIds.length > 0
      ? await db
        .select({ clientId: programsTable.clientId })
        .from(programsTable)
        .where(and(eq(programsTable.sourceTemplateId, programId), inArray(programsTable.clientId, authorizedIds)))
      : [];
    const alreadyAssignedIds = new Set(alreadyAssigned.map(r => r.clientId).filter((id): id is number => id !== null));

    const toAssign = authorizedIds.filter(id => !alreadyAssignedIds.has(id));
    const skipped = authorizedIds.filter(id => alreadyAssignedIds.has(id));
    const assigned: number[] = [];

    const toDateStr = (d: Date) => d.toISOString().split("T")[0];

    for (const clientId of toAssign) {
      try {
        const programName = await db.transaction(async (tx) => {
          // Remove any existing assignment first
          const [existingAssignment] = await tx.select().from(programAssignmentsTable).where(eq(programAssignmentsTable.clientId, clientId));
          if (existingAssignment) {
            await insertProgramHistory(tx, clientId, existingAssignment.programId, existingAssignment.startDate);
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
    if (!(await approvedProgramBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Approved program not found" });
      return;
    }

    const synced: number[] = [];

    // Verify all requested clientIds belong to this coach (prevent cross-tenant mutation)
    const coachClientsSync = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.coachId, coachIdOf(req)));
    const coachClientIdSetSync = new Set(coachClientsSync.map(c => c.id));
    const authorizedSyncIds = body.clientIds.filter(id => coachClientIdSetSync.has(id));

    for (const clientId of authorizedSyncIds) {
      try {
        const programName = await db.transaction(async (tx) => {
          const [currentAssignment] = await tx.select().from(programAssignmentsTable).where(eq(programAssignmentsTable.clientId, clientId));
          if (!currentAssignment) return null;
          const [currentProgram] = await tx.select().from(programsTable).where(eq(programsTable.id, currentAssignment.programId));
          // Only sync if this client's program was derived from the exact same template
          if (!currentProgram?.sourceTemplateId || currentProgram.sourceTemplateId !== programId) return null;

          await insertProgramHistory(tx, clientId, currentProgram.id, currentAssignment.startDate);
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

// ── Program Nutrition Periods ─────────────────────────────────────────────

const NutritionPeriodBody = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  label: z.string().optional(),
  calories: z.number().nullish(),
  protein: z.number().nullish(),
  carbs: z.number().nullish(),
  fat: z.number().nullish(),
});

router.get("/programs/:programId/nutrition-periods", requireCoachAuth, async (req, res) => {
  try {
    const programId = Number(req.params.programId);
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Program not found" }); return;
    }
    const periods = await db
      .select()
      .from(programNutritionPeriodsTable)
      .where(eq(programNutritionPeriodsTable.programId, programId))
      .orderBy(asc(programNutritionPeriodsTable.startDate));
    res.json(periods);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list nutrition periods" });
  }
});

router.post("/programs/:programId/nutrition-periods", requireCoachAuth, async (req, res) => {
  try {
    const programId = Number(req.params.programId);
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Program not found" }); return;
    }
    const body = NutritionPeriodBody.parse(req.body);
    const [period] = await db.insert(programNutritionPeriodsTable).values({
      programId,
      startDate: body.startDate,
      endDate: body.endDate,
      label: body.label ?? null,
      calories: body.calories ?? null,
      protein: body.protein ?? null,
      carbs: body.carbs ?? null,
      fat: body.fat ?? null,
    }).returning();
    res.status(201).json(period);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create nutrition period" });
  }
});

router.put("/programs/:programId/nutrition-periods/:periodId", requireCoachAuth, async (req, res) => {
  try {
    const programId = Number(req.params.programId);
    const periodId = Number(req.params.periodId);
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Program not found" }); return;
    }
    const body = NutritionPeriodBody.parse(req.body);
    const [updated] = await db
      .update(programNutritionPeriodsTable)
      .set({
        startDate: body.startDate,
        endDate: body.endDate,
        label: body.label ?? null,
        calories: body.calories ?? null,
        protein: body.protein ?? null,
        carbs: body.carbs ?? null,
        fat: body.fat ?? null,
      })
      .where(and(eq(programNutritionPeriodsTable.id, periodId), eq(programNutritionPeriodsTable.programId, programId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Period not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update nutrition period" });
  }
});

router.delete("/programs/:programId/nutrition-periods/:periodId", requireCoachAuth, async (req, res) => {
  try {
    const programId = Number(req.params.programId);
    const periodId = Number(req.params.periodId);
    if (!(await programBelongsToCoach(programId, coachIdOf(req)))) {
      res.status(404).json({ error: "Program not found" }); return;
    }
    await db
      .delete(programNutritionPeriodsTable)
      .where(and(eq(programNutritionPeriodsTable.id, periodId), eq(programNutritionPeriodsTable.programId, programId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete nutrition period" });
  }
});

export default router;
