import { Router } from "express";
import { db } from "@workspace/db";
import { exercisesTable } from "@workspace/db";
import { CreateExerciseBody } from "@workspace/api-zod";

const router = Router();

router.get("/exercises", async (req, res) => {
  try {
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

router.post("/exercises", async (req, res) => {
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
