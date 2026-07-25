import { Router } from "express";
import { db } from "@workspace/db";
import { exercisesTable } from "@workspace/db";
import { CreateExerciseBody, UpdateExerciseBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { requireCoachAuth } from "../middlewares/auth";

const router = Router();

type ExerciseSeed = {
  name: string;
  muscleGroup: string;
  description?: string;
  isCompound: boolean;
  movementPattern: string;
};

const EXERCISE_CATALOG: ExerciseSeed[] = [
  // Chest
  { name: "Bench Press", muscleGroup: "Chest", description: "Barbell press on a flat bench", isCompound: true, movementPattern: "bilateral" },
  { name: "Incline Bench Press", muscleGroup: "Chest", description: "Barbell press on an incline bench", isCompound: true, movementPattern: "bilateral" },
  { name: "Dumbbell Fly", muscleGroup: "Chest", description: "Wide arc fly motion with dumbbells", isCompound: false, movementPattern: "bilateral" },
  { name: "Push-Up", muscleGroup: "Chest", description: "Bodyweight pressing movement", isCompound: true, movementPattern: "bilateral" },
  { name: "Cable Crossover", muscleGroup: "Chest", description: "Cable fly with adjustable pulleys", isCompound: false, movementPattern: "bilateral" },
  // Back
  { name: "Pull-Up", muscleGroup: "Back", description: "Bodyweight vertical pull", isCompound: true, movementPattern: "bilateral" },
  { name: "Barbell Row", muscleGroup: "Back", description: "Bent-over row with barbell", isCompound: true, movementPattern: "bilateral" },
  { name: "Lat Pulldown", muscleGroup: "Back", description: "Cable pulldown to chest", isCompound: true, movementPattern: "bilateral" },
  { name: "Seated Cable Row", muscleGroup: "Back", description: "Horizontal cable pull seated", isCompound: true, movementPattern: "bilateral" },
  { name: "Dumbbell Row", muscleGroup: "Back", description: "Single-arm row with dumbbell", isCompound: true, movementPattern: "unilateral" },
  // Shoulders
  { name: "Overhead Press", muscleGroup: "Shoulders", description: "Barbell or dumbbell press overhead", isCompound: true, movementPattern: "bilateral" },
  { name: "Lateral Raise", muscleGroup: "Shoulders", description: "Raise dumbbells out to the sides", isCompound: false, movementPattern: "bilateral" },
  { name: "Front Raise", muscleGroup: "Shoulders", description: "Raise weight in front of body", isCompound: false, movementPattern: "bilateral" },
  { name: "Arnold Press", muscleGroup: "Shoulders", description: "Rotating dumbbell press", isCompound: true, movementPattern: "bilateral" },
  { name: "Face Pull", muscleGroup: "Shoulders", description: "Cable pull to face height", isCompound: false, movementPattern: "bilateral" },
  // Biceps
  { name: "Barbell Curl", muscleGroup: "Biceps", description: "Standard curl with barbell", isCompound: false, movementPattern: "bilateral" },
  { name: "Dumbbell Curl", muscleGroup: "Biceps", description: "Alternating or simultaneous dumbbell curl", isCompound: false, movementPattern: "bilateral" },
  { name: "Hammer Curl", muscleGroup: "Biceps", description: "Neutral-grip dumbbell curl", isCompound: false, movementPattern: "bilateral" },
  { name: "Concentration Curl", muscleGroup: "Biceps", description: "Curl braced against inner thigh", isCompound: false, movementPattern: "unilateral" },
  { name: "Preacher Curl", muscleGroup: "Biceps", description: "Curl on a preacher bench", isCompound: false, movementPattern: "bilateral" },
  // Triceps
  { name: "Tricep Pushdown", muscleGroup: "Triceps", description: "Cable pushdown with straight or rope attachment", isCompound: false, movementPattern: "bilateral" },
  { name: "Skull Crusher", muscleGroup: "Triceps", description: "EZ-bar or dumbbell lying tricep extension", isCompound: false, movementPattern: "bilateral" },
  { name: "Overhead Tricep Extension", muscleGroup: "Triceps", description: "Dumbbell or cable extension overhead", isCompound: false, movementPattern: "bilateral" },
  { name: "Close-Grip Bench Press", muscleGroup: "Triceps", description: "Narrow grip bench for tricep focus", isCompound: true, movementPattern: "bilateral" },
  { name: "Tricep Dip", muscleGroup: "Triceps", description: "Bodyweight or weighted dips", isCompound: true, movementPattern: "bilateral" },
  // Traps
  { name: "Barbell Shrug", muscleGroup: "Traps", description: "Shrug with barbell or dumbbells", isCompound: false, movementPattern: "bilateral" },
  { name: "Dumbbell Shrug", muscleGroup: "Traps", description: "Shrug motion with dumbbells", isCompound: false, movementPattern: "bilateral" },
  { name: "Farmer's Carry", muscleGroup: "Traps", description: "Walk with heavy weights at sides", isCompound: true, movementPattern: "bilateral" },
  { name: "Rack Pull", muscleGroup: "Traps", description: "Partial deadlift from knee height", isCompound: true, movementPattern: "bilateral" },
  // Legs
  { name: "Squat", muscleGroup: "Legs", description: "Barbell back squat", isCompound: true, movementPattern: "bilateral" },
  { name: "Deadlift", muscleGroup: "Legs", description: "Conventional barbell deadlift", isCompound: true, movementPattern: "bilateral" },
  { name: "Leg Press", muscleGroup: "Legs", description: "Machine press for lower body", isCompound: true, movementPattern: "bilateral" },
  { name: "Leg Extension", muscleGroup: "Legs", description: "Quad isolation on machine", isCompound: false, movementPattern: "bilateral" },
  { name: "Romanian Deadlift", muscleGroup: "Legs", description: "Hip-hinge deadlift with soft knees", isCompound: true, movementPattern: "bilateral" },
  { name: "Lunge", muscleGroup: "Legs", description: "Step forward into a lunge", isCompound: true, movementPattern: "unilateral" },
  { name: "Single-Leg Press", muscleGroup: "Legs", description: "One-legged leg press on machine", isCompound: true, movementPattern: "unilateral" },
  { name: "Leg Curl", muscleGroup: "Legs", description: "Hamstring curl on machine", isCompound: false, movementPattern: "bilateral" },
  // Glutes
  { name: "Hip Thrust", muscleGroup: "Glutes", description: "Barbell hip thrust off a bench", isCompound: true, movementPattern: "bilateral" },
  { name: "Single-Leg Hip Thrust", muscleGroup: "Glutes", description: "Hip thrust on one leg", isCompound: true, movementPattern: "unilateral" },
  { name: "Bulgarian Split Squat", muscleGroup: "Glutes", description: "Rear foot elevated split squat", isCompound: true, movementPattern: "unilateral" },
  { name: "Cable Kickback", muscleGroup: "Glutes", description: "Cable glute kickback", isCompound: false, movementPattern: "unilateral" },
  // Core
  { name: "Plank", muscleGroup: "Core", description: "Isometric hold in push-up position", isCompound: false, movementPattern: "bilateral" },
  { name: "Crunch", muscleGroup: "Core", description: "Basic abdominal crunch", isCompound: false, movementPattern: "bilateral" },
  { name: "Bicycle Crunch", muscleGroup: "Core", description: "Alternating elbow-to-knee crunch", isCompound: false, movementPattern: "bilateral" },
  { name: "Russian Twist", muscleGroup: "Core", description: "Seated rotational core movement", isCompound: false, movementPattern: "bilateral" },
  { name: "Hanging Leg Raise", muscleGroup: "Core", description: "Leg raise hanging from a bar", isCompound: false, movementPattern: "bilateral" },
  // Full Body
  { name: "Clean and Press", muscleGroup: "Full Body", description: "Power clean into overhead press", isCompound: true, movementPattern: "bilateral" },
  { name: "Kettlebell Swing", muscleGroup: "Full Body", description: "Hip-driven kettlebell swing", isCompound: true, movementPattern: "bilateral" },
  { name: "Burpee", muscleGroup: "Full Body", description: "Jump, squat thrust, and push-up combo", isCompound: true, movementPattern: "bilateral" },
  { name: "Thruster", muscleGroup: "Full Body", description: "Front squat into overhead press", isCompound: true, movementPattern: "bilateral" },
  // Cardio
  { name: "Running", muscleGroup: "Cardio", description: "Steady-state or interval running", isCompound: true, movementPattern: "bilateral" },
  { name: "Cycling", muscleGroup: "Cardio", description: "Bike or stationary cycling", isCompound: true, movementPattern: "bilateral" },
  { name: "Jump Rope", muscleGroup: "Cardio", description: "Skipping rope cardio", isCompound: true, movementPattern: "bilateral" },
  { name: "Rowing Machine", muscleGroup: "Cardio", description: "Full-body cardio on rowing ergometer", isCompound: true, movementPattern: "bilateral" },
  // HIIT
  { name: "Box Jump", muscleGroup: "HIIT", description: "Explosive jump onto a box", isCompound: true, movementPattern: "bilateral" },
  { name: "Sprint Interval", muscleGroup: "HIIT", description: "Short maximum-effort sprints", isCompound: true, movementPattern: "bilateral" },
  { name: "Battle Ropes", muscleGroup: "HIIT", description: "Alternating rope waves", isCompound: true, movementPattern: "bilateral" },
  // Mobility
  { name: "Hip Flexor Stretch", muscleGroup: "Mobility", description: "Lunge-position hip flexor stretch", isCompound: false, movementPattern: "unilateral" },
  { name: "Downward Dog", muscleGroup: "Mobility", description: "Yoga pose stretching hamstrings and shoulders", isCompound: false, movementPattern: "bilateral" },
  { name: "Cat-Cow", muscleGroup: "Mobility", description: "Spinal flexion and extension on hands and knees", isCompound: false, movementPattern: "bilateral" },
  { name: "Pigeon Pose", muscleGroup: "Mobility", description: "Deep hip external rotation stretch", isCompound: false, movementPattern: "unilateral" },
  { name: "World's Greatest Stretch", muscleGroup: "Mobility", description: "Multi-joint mobility drill", isCompound: false, movementPattern: "unilateral" },
  { name: "Thoracic Rotation", muscleGroup: "Mobility", description: "Upper back rotation drill", isCompound: false, movementPattern: "unilateral" },
];

async function seedExercises() {
  try {
    const existing = await db.select({ name: exercisesTable.name }).from(exercisesTable);
    const existingNames = new Set(existing.map(e => e.name));

    const toInsert = EXERCISE_CATALOG.filter(e => !existingNames.has(e.name));
    if (toInsert.length > 0) {
      await db.insert(exercisesTable).values(
        toInsert.map(e => ({
          name: e.name,
          muscleGroup: e.muscleGroup,
          description: e.description ?? null,
          isCompound: e.isCompound,
          isUnilateral: e.movementPattern === "unilateral",
          movementPattern: e.movementPattern,
        }))
      );
    }

    // Backfill isCompound and movementPattern for existing exercises that match catalog names
    const knownNames = EXERCISE_CATALOG.map(e => e.name);
    const toBackfill = EXERCISE_CATALOG.filter(e => existingNames.has(e.name));
    if (toBackfill.length > 0) {
      for (const exercise of toBackfill) {
        await db.update(exercisesTable)
          .set({ isCompound: exercise.isCompound, isUnilateral: exercise.movementPattern === "unilateral", movementPattern: exercise.movementPattern, muscleGroup: exercise.muscleGroup })
          .where(eq(exercisesTable.name, exercise.name));
      }
    }

    // Remove deprecated exercises
    const { like } = await import("drizzle-orm");
    await db.delete(exercisesTable).where(like(exercisesTable.name, "%Smith Machine%"));
  } catch {
    // non-fatal
  }
}

void seedExercises();

function serializeExercise(e: typeof exercisesTable.$inferSelect) {
  return {
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    isCompound: e.isCompound,
    isUnilateral: e.isUnilateral,
    movementPattern: e.movementPattern ?? null,
    description: e.description ?? null,
    videoUrl: e.videoUrl ?? null,
    equipment: e.equipment ?? "Other",
    difficulty: e.difficulty ?? "Intermediate",
    createdAt: e.createdAt.toISOString(),
  };
}

// Shared global exercise catalog — readable by any signed-in user (coach or client).
router.get("/exercises", async (req, res) => {
  try {
    if (!req.session?.coachId && !req.session?.clientId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const exercises = await db.select().from(exercisesTable).orderBy(exercisesTable.name);
    res.json(exercises.map(serializeExercise));
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
      isCompound: body.isCompound ?? false,
      isUnilateral: body.isUnilateral ?? false,
      movementPattern: body.movementPattern ?? null,
      description: body.description ?? null,
      videoUrl: body.videoUrl ?? null,
      equipment: body.equipment ?? "Other",
      difficulty: body.difficulty ?? "Intermediate",
    }).returning();
    res.status(201).json(serializeExercise(exercise));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create exercise" });
  }
});

router.patch("/exercises/:exerciseId", requireCoachAuth, async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.exerciseId as string, 10);
    if (isNaN(exerciseId)) {
      res.status(400).json({ error: "Invalid exercise ID" });
      return;
    }
    const body = UpdateExerciseBody.parse(req.body);
    const updates: Partial<typeof exercisesTable.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.muscleGroup !== undefined) updates.muscleGroup = body.muscleGroup;
    if (body.isCompound !== undefined) updates.isCompound = body.isCompound;
    if (body.isUnilateral !== undefined) updates.isUnilateral = body.isUnilateral;
    if ("movementPattern" in body) updates.movementPattern = body.movementPattern ?? null;
    if ("description" in body) updates.description = body.description ?? null;
    if ("videoUrl" in body) updates.videoUrl = body.videoUrl ?? null;
    if (body.equipment !== undefined) updates.equipment = body.equipment;
    if (body.difficulty !== undefined) updates.difficulty = body.difficulty;

    const [exercise] = await db.update(exercisesTable)
      .set(updates)
      .where(eq(exercisesTable.id, exerciseId))
      .returning();

    if (!exercise) {
      res.status(404).json({ error: "Exercise not found" });
      return;
    }
    res.json(serializeExercise(exercise));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update exercise" });
  }
});

export default router;
