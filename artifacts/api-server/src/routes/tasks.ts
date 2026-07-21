import { Router } from "express";
import { db } from "@workspace/db";
import { clientTasksTable, messagesTable, clientsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireClientOwnership, requireCoachAuth } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod/v4";

const router = Router();

function coachIdOf(req: import("express").Request): number {
  const actor = req.actor;
  return actor?.type === "coach" ? actor.coach.id : -1;
}

function serializeTask(t: typeof clientTasksTable.$inferSelect) {
  return {
    id: t.id,
    clientId: t.clientId,
    text: t.text,
    status: t.status,
    rejectionReason: t.rejectionReason ?? null,
    alternativeText: t.alternativeText ?? null,
    altStatus: t.altStatus ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

async function verifyCoachOwnsClient(coachId: number, clientId: number): Promise<boolean> {
  const [client] = await db.select({ id: clientsTable.id }).from(clientsTable)
    .where(and(eq(clientsTable.id, clientId), eq(clientsTable.coachId, coachId)));
  return !!client;
}

async function verifyClientOwnsTask(clientId: number, taskId: number) {
  const [task] = await db.select().from(clientTasksTable)
    .where(and(eq(clientTasksTable.id, taskId), eq(clientTasksTable.clientId, clientId)));
  return task ?? null;
}

// POST /api/clients/:clientId/tasks — coach assigns a task
router.post("/clients/:clientId/tasks", requireCoachAuth, async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const coachId = coachIdOf(req);
    if (!(await verifyCoachOwnsClient(coachId, clientId))) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    const body = z.object({ text: z.string().min(1).max(2000) }).parse(req.body);

    const [task] = await db.insert(clientTasksTable).values({
      clientId,
      text: body.text,
      status: "pending",
    }).returning();

    await db.insert(messagesTable).values({
      clientId,
      sender: "coach",
      content: body.text,
      messageType: "task_assigned",
      taskId: task.id,
    });

    res.status(201).json(serializeTask(task));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to assign task" });
  }
});

// GET /api/clients/:clientId/tasks/active — active task for client home screen
router.get("/clients/:clientId/tasks/active", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const [task] = await db.select().from(clientTasksTable)
      .where(and(eq(clientTasksTable.clientId, clientId), eq(clientTasksTable.status, "accepted")))
      .orderBy(desc(clientTasksTable.createdAt))
      .limit(1);
    res.json(task ? serializeTask(task) : null);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get active task" });
  }
});

// PATCH /api/clients/:clientId/tasks/:taskId/accept — client accepts
router.patch("/clients/:clientId/tasks/:taskId/accept", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const taskId = Number(req.params.taskId);
    const actor = req.actor;
    if (actor?.type !== "client") {
      res.status(403).json({ error: "Clients only" });
      return;
    }
    const task = await verifyClientOwnsTask(clientId, taskId);
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const isAlt = task.status === "rejected" && task.altStatus === "pending";
    const updates: Partial<typeof clientTasksTable.$inferInsert> = {
      status: "accepted",
      updatedAt: new Date(),
    };
    if (isAlt) updates.altStatus = "accepted";

    const [updated] = await db.update(clientTasksTable).set(updates)
      .where(eq(clientTasksTable.id, taskId)).returning();

    await db.insert(messagesTable).values({
      clientId,
      sender: "client",
      content: isAlt ? "Alternative accepted ✓" : "Task accepted ✓",
      messageType: "text",
      taskId,
    });

    res.json(serializeTask(updated));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to accept task" });
  }
});

// PATCH /api/clients/:clientId/tasks/:taskId/reject — client rejects with reason
router.patch("/clients/:clientId/tasks/:taskId/reject", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const taskId = Number(req.params.taskId);
    const actor = req.actor;
    if (actor?.type !== "client") {
      res.status(403).json({ error: "Clients only" });
      return;
    }
    const task = await verifyClientOwnsTask(clientId, taskId);
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const body = z.object({ reason: z.string().min(1).max(2000) }).parse(req.body);

    const isAlt = task.status === "rejected" && task.altStatus === "pending";
    const updates: Partial<typeof clientTasksTable.$inferInsert> = {
      status: "rejected",
      rejectionReason: body.reason,
      updatedAt: new Date(),
    };
    if (isAlt) updates.altStatus = "rejected";

    const [updated] = await db.update(clientTasksTable).set(updates)
      .where(eq(clientTasksTable.id, taskId)).returning();

    // Insert a rejection message so coach sees it in conversation
    await db.insert(messagesTable).values({
      clientId,
      sender: "client",
      content: body.reason,
      messageType: "task_rejected",
      taskId,
    });

    res.json(serializeTask(updated));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to reject task" });
  }
});

// PATCH /api/clients/:clientId/tasks/:taskId/complete — client marks complete
router.patch("/clients/:clientId/tasks/:taskId/complete", requireClientOwnership(), async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const taskId = Number(req.params.taskId);
    const actor = req.actor;
    if (actor?.type !== "client") {
      res.status(403).json({ error: "Clients only" });
      return;
    }
    const task = await verifyClientOwnsTask(clientId, taskId);
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const [updated] = await db.update(clientTasksTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(clientTasksTable.id, taskId)).returning();

    await db.insert(messagesTable).values({
      clientId,
      sender: "client",
      content: "Task completed ✓",
      messageType: "text",
      taskId,
    });

    res.json(serializeTask(updated));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to complete task" });
  }
});

// PATCH /api/clients/:clientId/tasks/:taskId/suggest — coach suggests alternative
router.patch("/clients/:clientId/tasks/:taskId/suggest", requireCoachAuth, async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const taskId = Number(req.params.taskId);
    const coachId = coachIdOf(req);
    if (!(await verifyCoachOwnsClient(coachId, clientId))) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    const [task] = await db.select().from(clientTasksTable)
      .where(and(eq(clientTasksTable.id, taskId), eq(clientTasksTable.clientId, clientId)));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const body = z.object({ alternativeText: z.string().min(1).max(2000) }).parse(req.body);

    const [updated] = await db.update(clientTasksTable).set({
      alternativeText: body.alternativeText,
      altStatus: "pending",
      updatedAt: new Date(),
    }).where(eq(clientTasksTable.id, taskId)).returning();

    await db.insert(messagesTable).values({
      clientId,
      sender: "coach",
      content: body.alternativeText,
      messageType: "task_alternative",
      taskId,
    });

    res.json(serializeTask(updated));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to suggest alternative" });
  }
});

// PATCH /api/clients/:clientId/tasks/:taskId/leave — coach leaves it alone
router.patch("/clients/:clientId/tasks/:taskId/leave", requireCoachAuth, async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const taskId = Number(req.params.taskId);
    const coachId = coachIdOf(req);
    if (!(await verifyCoachOwnsClient(coachId, clientId))) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    const [task] = await db.select().from(clientTasksTable)
      .where(and(eq(clientTasksTable.id, taskId), eq(clientTasksTable.clientId, clientId)));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const [updated] = await db.update(clientTasksTable).set({
      altStatus: "left_alone",
      updatedAt: new Date(),
    }).where(eq(clientTasksTable.id, taskId)).returning();

    await db.insert(messagesTable).values({
      clientId,
      sender: "coach",
      content: "I'll leave this one — no alternative needed.",
      messageType: "text",
      taskId,
    });

    res.json(serializeTask(updated));
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update task" });
  }
});

// GET /api/clients/:clientId/tasks/:taskId/ai-alternatives — AI-generated suggestions
router.get("/clients/:clientId/tasks/:taskId/ai-alternatives", requireCoachAuth, async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const taskId = Number(req.params.taskId);
    const coachId = coachIdOf(req);
    if (!(await verifyCoachOwnsClient(coachId, clientId))) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    const [task] = await db.select().from(clientTasksTable)
      .where(and(eq(clientTasksTable.id, taskId), eq(clientTasksTable.clientId, clientId)));
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }

    const prompt = `A fitness coach assigned a client this task: "${task.text}"
The client rejected it${task.rejectionReason ? ` with this reason: "${task.rejectionReason}"` : ""}.
Suggest exactly 3 concise alternative tasks the coach could assign instead.
Return ONLY a JSON array of 3 strings, no markdown, no explanations. Example: ["Walk 20 min daily", "Do 10 bodyweight squats", "Stretch for 5 minutes"]`;

    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a helpful fitness coach assistant. Return only valid JSON." },
        { role: "user", content: prompt + '\n\nReturn format: {"alternatives": ["...", "...", "..."]}' },
      ],
    });

    const raw = aiRes.choices[0]?.message?.content ?? "{}";
    let alternatives: string[] = [];
    try {
      const parsed = JSON.parse(raw) as { alternatives?: string[] };
      alternatives = Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3) : [];
    } catch {
      req.log.warn({ raw }, "Failed to parse AI alternatives response");
    }

    if (alternatives.length < 3) {
      alternatives = [
        `Try ${task.text} for just 5 minutes`,
        "Take a 10-minute walk instead",
        "Do a lighter version of the original task",
      ].slice(0, 3 - alternatives.length).concat(alternatives.slice(0, alternatives.length));
      alternatives = alternatives.slice(0, 3);
    }

    res.json({ alternatives });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate alternatives" });
  }
});

export default router;
