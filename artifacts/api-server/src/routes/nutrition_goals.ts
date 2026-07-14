import { Router, type RequestHandler } from "express";
import { db } from "@workspace/db";
import {
  nutritionGoalsTable,
  programAssignmentsTable,
  programsTable,
  programPhasesTable,
  programDaysTable,
  programNutritionGoalsTable,
} from "@workspace/db";
import { eq, desc, asc, inArray, and } from "drizzle-orm";
import { requireClientOwnership } from "../middlewares/auth";
import { chooseDayType } from "../lib/day-type.js";
import { hasWorkoutOnDate } from "../lib/workout-lookup.js";

type DayType = "any" | "training" | "rest";

function toInt(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}

async function resolveProgramNutritionGoal(clientId: number) {
  const [assignment] = await db.select().from(programAssignmentsTable)
    .where(eq(programAssignmentsTable.clientId, clientId))
    .orderBy(desc(programAssignmentsTable.createdAt))
    .limit(1);
  if (!assignment) return null;

  const [program] = await db.select().from(programsTable).where(eq(programsTable.id, assignment.programId));
  if (!program) return null;

  const phases = await db.select().from(programPhasesTable)
    .where(eq(programPhasesTable.programId, program.id))
    .orderBy(asc(programPhasesTable.order));
  if (phases.length === 0) return null;

  const days = await db.select().from(programDaysTable)
    .where(eq(programDaysTable.programId, program.id))
    .orderBy(asc(programDaysTable.dayNumber));

  const phaseIds = phases.map(p => p.id);
  const nutritionGoals = await db.select().from(programNutritionGoalsTable)
    .where(inArray(programNutritionGoalsTable.phaseId, phaseIds));

  const start = new Date(assignment.startDate);
  const now = new Date(new Date().toISOString().split("T")[0]);
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  let remaining = elapsedDays;
  let activePhase = phases[phases.length - 1];
  let daysIntoPhase = 0;
  for (const phase of phases) {
    const phaseDurationDays = phase.durationWeeks * 7;
    if (remaining < phaseDurationDays) {
      activePhase = phase;
      daysIntoPhase = remaining;
      break;
    }
    remaining -= phaseDurationDays;
    daysIntoPhase = remaining;
  }

  const phaseDays = days.filter(d => d.phaseId === activePhase.id);
  const activeDay = phaseDays.length > 0
    ? phaseDays[((daysIntoPhase % phaseDays.length) + phaseDays.length) % phaseDays.length]
    : null;

  const dayOverride = activeDay
    ? nutritionGoals.find(g => g.phaseId === activePhase.id && g.dayId === activeDay.id)
    : undefined;
  const phaseDefault = nutritionGoals.find(g => g.phaseId === activePhase.id && g.dayId === null);

  const resolved = dayOverride ?? phaseDefault;
  if (!resolved) return null;

  return {
    calories: resolved.calories,
    protein: resolved.protein,
    carbs: resolved.carbs,
    fat: resolved.fat,
    source: dayOverride ? "day" as const : "phase" as const,
    phaseName: activePhase.name,
    programName: program.name,
  };
}

async function getLatestGoalByDayType(clientId: number, dayType: DayType) {
  const [goal] = await db.select().from(nutritionGoalsTable)
    .where(and(eq(nutritionGoalsTable.clientId, clientId), eq(nutritionGoalsTable.dayType, dayType)))
    .orderBy(desc(nutritionGoalsTable.createdAt))
    .limit(1);
  return goal ?? null;
}

// ── Injectable context ────────────────────────────────────────────────────
// Separating the I/O operations from the route wiring makes the GET handler
// testable without a live database or module-level mocking.

type NutritionGoalRow = Awaited<ReturnType<typeof getLatestGoalByDayType>>;
type ProgramGoalRow = Awaited<ReturnType<typeof resolveProgramNutritionGoal>>;

export type RouteContext = {
  checkOwnership: () => RequestHandler;
  hasWorkout: (clientId: number, date: string) => Promise<boolean>;
  getGoal: (clientId: number, dayType: DayType) => Promise<NutritionGoalRow | null>;
  getProgram: (clientId: number) => Promise<ProgramGoalRow>;
};

const defaultCtx: RouteContext = {
  checkOwnership: requireClientOwnership,
  hasWorkout: hasWorkoutOnDate,
  getGoal: getLatestGoalByDayType,
  getProgram: resolveProgramNutritionGoal,
};

/**
 * Creates the nutrition-goals router.
 * Pass a partial context to override dependencies (useful in tests).
 */
export function makeNutritionGoalsRouter(ctx: Partial<RouteContext> = {}): Router {
  const {
    checkOwnership = defaultCtx.checkOwnership,
    hasWorkout = defaultCtx.hasWorkout,
    getGoal = defaultCtx.getGoal,
    getProgram = defaultCtx.getProgram,
  } = ctx;

  const router = Router();

  router.get("/clients/:clientId/nutrition-goal", checkOwnership(), async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }

      const view = req.query.view as string | undefined;
      const dateParam = typeof req.query.date === "string" ? req.query.date : null;

      if (view === "all") {
        const [trainingGoal, restGoal, anyGoal] = await Promise.all([
          getGoal(clientId, "training"),
          getGoal(clientId, "rest"),
          getGoal(clientId, "any"),
        ]);
        const fmt = (g: NutritionGoalRow | null) => g ? { ...g, createdAt: g.createdAt.toISOString() } : null;
        res.json({ training: fmt(trainingGoal), rest: fmt(restGoal), any: fmt(anyGoal) });
        return;
      }

      // Resolve program-driven goal. If the lookup fails (corrupt assignment,
      // DB error) log a warning and fall through to coach-set goals rather than
      // returning 500.
      let programGoal: ProgramGoalRow = null;
      try {
        programGoal = await getProgram(clientId);
      } catch (err) {
        req.log.warn({ err, clientId }, "Program goal resolution failed; falling through to coach-set goals");
      }
      if (programGoal) {
        // Program goals are schedule-based, not training/rest based.
        res.json({ ...programGoal, dayType: "any" as const, isTrainingDay: null });
        return;
      }

      const date = dateParam ?? new Date().toISOString().split("T")[0];

      // Resolve whether today is a training day. If the workout-log query fails
      // (DB error, timeout, etc.) we must NOT silently return a training or rest
      // goal — fall back to the "any" goal and log a warning.
      let isTrainingRaw: boolean | null;
      try {
        isTrainingRaw = await hasWorkout(clientId, date);
      } catch (err) {
        req.log.warn({ err, clientId, date }, "Workout-log lookup failed; falling back to all-days goal");
        isTrainingRaw = null;
      }

      const { preferredType, isTrainingDay, skipToAny } = chooseDayType(isTrainingRaw);

      if (!skipToAny) {
        const preferredGoal = await getGoal(clientId, preferredType);
        if (preferredGoal) {
          res.json({ ...preferredGoal, createdAt: preferredGoal.createdAt.toISOString(), dayType: preferredGoal.dayType, isTrainingDay });
          return;
        }
      }

      const anyGoal = await getGoal(clientId, "any");
      if (anyGoal) {
        res.json({ ...anyGoal, createdAt: anyGoal.createdAt.toISOString(), dayType: anyGoal.dayType, isTrainingDay });
        return;
      }

      res.json(null);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to fetch nutrition goal" });
    }
  });

  router.delete("/clients/:clientId/nutrition-goal/:dayType", checkOwnership(), async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
      const dayType = req.params.dayType as string | undefined;
      if (dayType !== "training" && dayType !== "rest") {
        res.status(400).json({ error: "dayType must be 'training' or 'rest'" });
        return;
      }
      await db.delete(nutritionGoalsTable)
        .where(and(eq(nutritionGoalsTable.clientId, clientId), eq(nutritionGoalsTable.dayType, dayType)));
      res.status(204).end();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to delete nutrition goal" });
    }
  });

  router.post("/clients/:clientId/nutrition-goal", checkOwnership(), async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
      const body = req.body as Record<string, unknown>;
      const periodType = (["day", "week", "phase"] as const).includes(body.periodType as never)
        ? (body.periodType as "day" | "week" | "phase")
        : "day";
      const dayType = (["any", "training", "rest"] as const).includes(body.dayType as never)
        ? (body.dayType as DayType)
        : "any";
      const [goal] = await db.insert(nutritionGoalsTable).values({
        clientId,
        calories: toInt(body.calories),
        protein: toInt(body.protein),
        carbs: toInt(body.carbs),
        fat: toInt(body.fat),
        waterOz: toInt(body.waterOz),
        periodType,
        effectiveWeek: toInt(body.effectiveWeek),
        durationWeeks: toInt(body.durationWeeks),
        notes: typeof body.notes === "string" ? body.notes : null,
        dayType,
      }).returning();
      res.status(201).json({ ...goal, createdAt: goal.createdAt.toISOString() });
    } catch (err) {
      req.log.error(err);
      res.status(400).json({ error: "Failed to set nutrition goal" });
    }
  });

  return router;
}

export default makeNutritionGoalsRouter();
