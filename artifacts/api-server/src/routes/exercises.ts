import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { exercisesTable } from "@workspace/db";
import { CreateExerciseBody } from "@workspace/api-zod";
import { eq, count } from "drizzle-orm";
import { requireCoachAuth } from "../middlewares/auth";

const router = Router();

const DEFAULT_EXERCISES: { name: string; muscleGroup: string; description?: string }[] = [
  { name: "Overhead Press", muscleGroup: "Shoulders", description: "Barbell or dumbbell press overhead" },
  { name: "Lateral Raise", muscleGroup: "Shoulders", description: "Raise dumbbells out to the sides" },
  { name: "Front Raise", muscleGroup: "Shoulders", description: "Raise weight in front of body" },
  { name: "Arnold Press", muscleGroup: "Shoulders", description: "Rotating dumbbell press" },
  { name: "Face Pull", muscleGroup: "Shoulders", description: "Cable pull to face height" },
  { name: "Tricep Pushdown", muscleGroup: "Triceps", description: "Cable pushdown with straight or rope attachment" },
  { name: "Skull Crusher", muscleGroup: "Triceps", description: "EZ-bar or dumbbell lying tricep extension" },
  { name: "Overhead Tricep Extension", muscleGroup: "Triceps", description: "Dumbbell or cable extension overhead" },
  { name: "Close-Grip Bench Press", muscleGroup: "Triceps", description: "Narrow grip bench for tricep focus" },
  { name: "Tricep Dip", muscleGroup: "Triceps", description: "Bodyweight or weighted dips" },
  { name: "Barbell Shrug", muscleGroup: "Traps", description: "Shrug with barbell or dumbbells" },
  { name: "Dumbbell Shrug", muscleGroup: "Traps", description: "Shrug motion with dumbbells" },
  { name: "Farmer's Carry", muscleGroup: "Traps", description: "Walk with heavy weights at sides" },
  { name: "Rack Pull", muscleGroup: "Traps", description: "Partial deadlift from knee height" },
];

async function seedMissingCategories() {
  try {
    // Remove deprecated exercises
    const { like } = await import("drizzle-orm");
    await db.delete(exercisesTable).where(like(exercisesTable.name, "%Smith Machine%"));

    const existing = await db.select({ muscleGroup: exercisesTable.muscleGroup })
      .from(exercisesTable);
    const existingGroups = new Set(existing.map(e => e.muscleGroup));
    const missing = DEFAULT_EXERCISES.filter(e => !existingGroups.has(e.muscleGroup));
    if (missing.length > 0) {
      await db.insert(exercisesTable).values(
        missing.map(e => ({ name: e.name, muscleGroup: e.muscleGroup, description: e.description ?? null }))
      );
    }
  } catch {
    // non-fatal
  }
}

void seedMissingCategories();

// Shared global exercise catalog — readable by any signed-in user (coach or client).
router.get("/exercises", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const exercises = await db.select().from(exercisesTable).orderBy(exercisesTable.name);
    res.json(exercises.map(e => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list exercises" });
  }
});

router.post("/exercises", requireCoachAuth, async (req, res) => {
  try {
    const body = CreateExerciseBody.parse(req.body);
    const [exercise] = await db.insert(exercisesTable).values({
      name: body.name,
      muscleGroup: body.muscleGroup,
      description: body.description ?? null,
    }).returning();
    res.status(201).json({ ...exercise, createdAt: exercise.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create exercise" });
  }
});

export default router;
