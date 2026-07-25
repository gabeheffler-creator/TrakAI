import { Router } from "express";
import { db } from "@workspace/db";
import { exerciseCuesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  ListExerciseCuesParams,
  CreateExerciseCueParams,
  CreateExerciseCueBody,
  DeleteExerciseCueParams,
} from "@workspace/api-zod";
import { requireClientOwnership, requireCoachOnly } from "../middlewares/auth";

const router = Router();

// Both coach and client can read exercise cues
router.get("/clients/:clientId/exercise-cues", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = ListExerciseCuesParams.parse({ clientId: Number(req.params.clientId) });
    const cues = await db.select().from(exerciseCuesTable)
      .where(eq(exerciseCuesTable.clientId, clientId))
      .orderBy(desc(exerciseCuesTable.createdAt));
    res.json(cues.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list exercise cues" });
  }
});

// Only coaches can create cues
router.post("/clients/:clientId/exercise-cues", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = CreateExerciseCueParams.parse({ clientId: Number(req.params.clientId) });
    const body = CreateExerciseCueBody.parse(req.body);
    const [cue] = await db.insert(exerciseCuesTable).values({
      clientId,
      exerciseId: body.exerciseId,
      callLogId: body.callLogId ?? null,
      note: body.note,
    }).returning();
    res.status(201).json({ ...cue, createdAt: cue.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create exercise cue" });
  }
});

// Only coaches can delete cues
router.delete("/clients/:clientId/exercise-cues/:cueId", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId, cueId } = DeleteExerciseCueParams.parse({ clientId: Number(req.params.clientId), cueId: Number(req.params.cueId) });
    await db.delete(exerciseCuesTable).where(and(eq(exerciseCuesTable.id, cueId), eq(exerciseCuesTable.clientId, clientId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete exercise cue" });
  }
});

export default router;
