import { Router } from "express";
import { db } from "@workspace/db";
import { assignmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListAssignmentsParams,
  CreateAssignmentParams,
  CreateAssignmentBody,
  UpdateAssignmentParams,
  UpdateAssignmentBody,
  DeleteAssignmentParams,
  CompleteAssignmentParams,
} from "@workspace/api-zod";
import { requireClientOwnership, requireCoachOnly } from "../middlewares/auth";

const router = Router();

const fmt = (a: any) => ({
  ...a,
  completedAt: a.completedAt ? a.completedAt.toISOString() : null,
  createdAt: a.createdAt.toISOString(),
});

router.get("/clients/:clientId/assignments", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = ListAssignmentsParams.parse({ clientId: Number(req.params.clientId) });
    const rows = await db.select().from(assignmentsTable)
      .where(eq(assignmentsTable.clientId, clientId))
      .orderBy(assignmentsTable.createdAt);
    res.json(rows.map(fmt));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list assignments" });
  }
});

router.post("/clients/:clientId/assignments", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = CreateAssignmentParams.parse({ clientId: Number(req.params.clientId) });
    const body = CreateAssignmentBody.parse(req.body);
    const [a] = await db.insert(assignmentsTable).values({
      clientId,
      title: body.title,
      type: body.type,
      body: body.body ?? null,
      targetValue: body.targetValue ?? null,
      dueDate: body.dueDate instanceof Date ? body.dueDate.toISOString().split("T")[0] : (body.dueDate ?? null),
      status: "pending",
    }).returning();
    res.status(201).json(fmt(a));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create assignment" });
  }
});

router.patch("/clients/:clientId/assignments/:assignmentId", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { assignmentId } = UpdateAssignmentParams.parse({
      clientId: Number(req.params.clientId),
      assignmentId: Number(req.params.assignmentId),
    });
    const body = UpdateAssignmentBody.parse(req.body);
    const [a] = await db.update(assignmentsTable).set({
      title: body.title,
      type: body.type,
      body: body.body ?? undefined,
      targetValue: body.targetValue ?? undefined,
      dueDate: body.dueDate instanceof Date ? body.dueDate.toISOString().split("T")[0] : (body.dueDate ?? undefined),
      status: body.status,
    }).where(eq(assignmentsTable.id, assignmentId)).returning();
    if (!a) { res.status(404).json({ error: "Assignment not found" }); return; }
    res.json(fmt(a));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update assignment" });
  }
});

router.delete("/clients/:clientId/assignments/:assignmentId", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { assignmentId } = DeleteAssignmentParams.parse({
      clientId: Number(req.params.clientId),
      assignmentId: Number(req.params.assignmentId),
    });
    await db.delete(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
});

router.post("/clients/:clientId/assignments/:assignmentId/complete", requireClientOwnership(), async (req, res) => {
  try {
    const { assignmentId } = CompleteAssignmentParams.parse({
      clientId: Number(req.params.clientId),
      assignmentId: Number(req.params.assignmentId),
    });
    const [a] = await db.update(assignmentsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(assignmentsTable.id, assignmentId))
      .returning();
    if (!a) { res.status(404).json({ error: "Assignment not found" }); return; }
    res.json(fmt(a));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to complete assignment" });
  }
});

export default router;
