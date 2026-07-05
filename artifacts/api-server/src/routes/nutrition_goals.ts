import { Router } from "express";
import { db } from "@workspace/db";
import {
  nutritionGoalsTable,
  programAssignmentsTable,
  programsTable,
  programPhasesTable,
  programDaysTable,
  programNutritionGoalsTable,
} from "@workspace/db";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { requireClientOwnership } from "../middlewares/auth";

const router = Router();

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

  // Walk phases in order to find which phase the elapsed days fall into.
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

router.get("/clients/:clientId/nutrition-goal", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }

    const programGoal = await resolveProgramNutritionGoal(clientId);
    if (programGoal) {
      res.json(programGoal);
      return;
    }

    const [goal] = await db.select().from(nutritionGoalsTable)
      .where(eq(nutritionGoalsTable.clientId, clientId))
      .orderBy(desc(nutritionGoalsTable.createdAt))
      .limit(1);
    res.json(goal ? { ...goal, createdAt: goal.createdAt.toISOString() } : null);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch nutrition goal" });
  }
});

router.post("/clients/:clientId/nutrition-goal", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) { res.status(400).json({ error: "Invalid clientId" }); return; }
    const body = req.body as Record<string, unknown>;
    const periodType = (["day", "week", "phase"] as const).includes(body.periodType as never)
      ? (body.periodType as "day" | "week" | "phase")
      : "day";
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
    }).returning();
    res.status(201).json({ ...goal, createdAt: goal.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to set nutrition goal" });
  }
});

export default router;
