import { db } from "@workspace/db";
import {
  programsTable,
  programPhasesTable,
  programDaysTable,
  programExercisesTable,
  programNutritionGoalsTable,
} from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";

export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function cloneProgram(
  dbtx: DbOrTx,
  sourceProgramId: number,
  coachId: number,
  clientId: number,
): Promise<number> {
  const [source] = await dbtx.select().from(programsTable).where(eq(programsTable.id, sourceProgramId));
  if (!source) throw new Error(`Program ${sourceProgramId} not found`);

  const [clone] = await dbtx.insert(programsTable).values({
    coachId,
    clientId,
    sourceTemplateId: sourceProgramId,
    name: source.name,
    description: source.description,
    durationWeeks: source.durationWeeks,
  }).returning();

  const sourcePhases = await dbtx.select().from(programPhasesTable)
    .where(eq(programPhasesTable.programId, sourceProgramId))
    .orderBy(asc(programPhasesTable.order));

  const phaseIdMap: Record<number, number> = {};
  for (const phase of sourcePhases) {
    const [newPhase] = await dbtx.insert(programPhasesTable).values({
      programId: clone.id,
      name: phase.name,
      order: phase.order,
      durationWeeks: phase.durationWeeks,
      daysPerWeek: phase.daysPerWeek,
    }).returning();
    phaseIdMap[phase.id] = newPhase.id;
  }

  const sourceNutritionGoals = sourcePhases.length > 0
    ? await dbtx.select().from(programNutritionGoalsTable)
        .where(inArray(programNutritionGoalsTable.phaseId, sourcePhases.map(p => p.id)))
    : [];

  const sourceDays = await dbtx.select().from(programDaysTable)
    .where(eq(programDaysTable.programId, sourceProgramId))
    .orderBy(asc(programDaysTable.dayNumber));

  const dayIdMap: Record<number, number> = {};
  for (const day of sourceDays) {
    const [newDay] = await dbtx.insert(programDaysTable).values({
      programId: clone.id,
      phaseId: day.phaseId != null ? (phaseIdMap[day.phaseId] ?? null) : null,
      dayNumber: day.dayNumber,
      name: day.name,
      notes: day.notes,
    }).returning();
    dayIdMap[day.id] = newDay.id;
  }

  for (const goal of sourceNutritionGoals) {
    await dbtx.insert(programNutritionGoalsTable).values({
      phaseId: phaseIdMap[goal.phaseId],
      dayId: goal.dayId != null ? (dayIdMap[goal.dayId] ?? null) : null,
      calories: goal.calories,
      protein: goal.protein,
      carbs: goal.carbs,
      fat: goal.fat,
    });
  }

  if (sourceDays.length > 0) {
    const sourceExercises = await dbtx.select().from(programExercisesTable)
      .where(inArray(programExercisesTable.dayId, sourceDays.map(d => d.id)))
      .orderBy(asc(programExercisesTable.order));

    for (const ex of sourceExercises) {
      const newDayId = dayIdMap[ex.dayId];
      if (!newDayId) continue;
      await dbtx.insert(programExercisesTable).values({
        dayId: newDayId,
        exerciseId: ex.exerciseId,
        sets: ex.sets,
        reps: ex.reps,
        order: ex.order,
        weight: ex.weight,
        notes: ex.notes,
        restSeconds: ex.restSeconds,
      });
    }
  }

  return clone.id;
}
