import { db, programsTable, programPhasesTable, programDaysTable, programExercisesTable, exercisesTable } from "@workspace/db";
import { PROGRAM_TEMPLATES, type ProgramTemplate } from "../data/program_templates";

/**
 * Clones a single program template into a real, fully-editable program owned
 * by the given coach (programs/phases/days/exercises rows). Reuses existing
 * exercise rows by name (case-insensitive) instead of creating duplicates.
 */
export async function instantiateProgramTemplateForCoach(coachId: number, template: ProgramTemplate): Promise<number> {
  const uniqueExercises = new Map<string, string>();
  for (const phase of template.phases) {
    for (const day of phase.days) {
      for (const e of day.exercises) {
        uniqueExercises.set(e.exerciseName, e.muscleGroup);
      }
    }
  }

  const existing = await db.select().from(exercisesTable);
  const existingByName = new Map(existing.map(e => [e.name.toLowerCase(), e]));
  const exerciseIdByName = new Map<string, number>();
  for (const [name, muscleGroup] of uniqueExercises) {
    const found = existingByName.get(name.toLowerCase());
    if (found) {
      exerciseIdByName.set(name, found.id);
    } else {
      const [created] = await db.insert(exercisesTable).values({ name, muscleGroup }).returning();
      exerciseIdByName.set(name, created.id);
    }
  }

  const [program] = await db.insert(programsTable).values({
    coachId,
    name: template.name,
    description: template.description,
    durationWeeks: template.durationWeeks,
  }).returning();

  for (let phaseOrder = 0; phaseOrder < template.phases.length; phaseOrder++) {
    const phaseDef = template.phases[phaseOrder];
    const [phase] = await db.insert(programPhasesTable).values({
      programId: program.id,
      name: phaseDef.name,
      order: phaseOrder,
      durationWeeks: phaseDef.durationWeeks,
      daysPerWeek: phaseDef.daysPerWeek,
    }).returning();

    for (const dayDef of phaseDef.days) {
      const [day] = await db.insert(programDaysTable).values({
        programId: program.id,
        phaseId: phase.id,
        dayNumber: dayDef.dayNumber,
        name: dayDef.name,
        notes: dayDef.notes ?? null,
      }).returning();

      for (let order = 0; order < dayDef.exercises.length; order++) {
        const exDef = dayDef.exercises[order];
        const exerciseId = exerciseIdByName.get(exDef.exerciseName);
        if (exerciseId === undefined) continue;
        await db.insert(programExercisesTable).values({
          dayId: day.id,
          exerciseId,
          sets: exDef.sets,
          reps: exDef.reps,
          order,
          restSeconds: exDef.restSeconds ?? null,
          notes: exDef.notes ?? null,
        });
      }
    }
  }

  return program.id;
}

/**
 * Instantiates every pre-built program template for the given coach.
 * Used both for brand-new coach signups and for backfilling existing
 * coaches who currently have zero programs.
 */
export async function instantiateAllProgramTemplatesForCoach(coachId: number): Promise<void> {
  for (const template of PROGRAM_TEMPLATES) {
    await instantiateProgramTemplateForCoach(coachId, template);
  }
}
