import { Router } from "express";
import { db } from "@workspace/db";
import { programsTable, programPhasesTable, programDaysTable, programExercisesTable, exercisesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireCoachAuth } from "../middlewares/auth";
import { PROGRAM_TEMPLATES, getProgramTemplate } from "../data/program_templates";

const router = Router();

function coachIdOf(req: import("express").Request): number {
  const actor = req.actor;
  return actor?.type === "coach" ? actor.coach.id : -1;
}

router.get("/program-templates", requireCoachAuth, async (req, res) => {
  try {
    const summaries = PROGRAM_TEMPLATES.map(t => ({
      key: t.key,
      name: t.name,
      description: t.description,
      focus: t.focus,
      durationWeeks: t.durationWeeks,
      phaseCount: t.phases.length,
      daysPerWeek: t.phases[0]?.daysPerWeek ?? 0,
    }));
    res.json(summaries);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list program templates" });
  }
});

router.post("/program-templates/:key/instantiate", requireCoachAuth, async (req, res) => {
  try {
    const template = getProgramTemplate(String(req.params.key));
    if (!template) { res.status(404).json({ error: "Template not found" }); return; }

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
      coachId: coachIdOf(req),
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

    res.status(201).json({ programId: program.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to instantiate program template" });
  }
});

export default router;
