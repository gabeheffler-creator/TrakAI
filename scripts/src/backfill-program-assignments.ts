import { db, pool } from "@workspace/db";
import {
  programsTable,
  programPhasesTable,
  programDaysTable,
  programExercisesTable,
  programNutritionGoalsTable,
  programAssignmentsTable,
  clientsTable,
} from "@workspace/db";
import { eq, asc, isNull, inArray } from "drizzle-orm";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function cloneProgram(
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

async function main() {
  console.log("Backfilling program assignments to use per-client copies...");

  const stale = await db
    .select({
      assignmentId: programAssignmentsTable.id,
      clientId: programAssignmentsTable.clientId,
      programId: programAssignmentsTable.programId,
      coachId: programsTable.coachId,
    })
    .from(programAssignmentsTable)
    .innerJoin(programsTable, eq(programAssignmentsTable.programId, programsTable.id))
    .where(isNull(programsTable.clientId));

  if (stale.length === 0) {
    console.log("No stale assignments found — nothing to do.");
    await pool.end();
    return;
  }

  console.log(`Found ${stale.length} assignment(s) pointing at template programs.`);

  let migrated = 0;
  let failed = 0;

  for (const row of stale) {
    try {
      await db.transaction(async (tx) => {
        const clonedId = await cloneProgram(tx, row.programId, row.coachId, row.clientId);
        await tx
          .update(programAssignmentsTable)
          .set({ programId: clonedId })
          .where(eq(programAssignmentsTable.id, row.assignmentId));
      });
      const [client] = await db.select({ name: clientsTable.name })
        .from(clientsTable).where(eq(clientsTable.id, row.clientId));
      console.log(`  ✓ Assignment ${row.assignmentId} (client: ${client?.name ?? row.clientId}) → new clone`);
      migrated++;
    } catch (err) {
      console.error(`  ✗ Assignment ${row.assignmentId} failed:`, err);
      failed++;
    }
  }

  console.log(`\nDone: ${migrated} migrated, ${failed} failed.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
