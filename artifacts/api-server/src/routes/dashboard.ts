import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable,
  workoutLogsTable,
  measurementsTable,
  programAssignmentsTable,
  assignmentsTable,
  messagesTable,
} from "@workspace/db";
import { eq, count, desc, and, gte, isNotNull, inArray } from "drizzle-orm";
import { GetClientDashboardParams } from "@workspace/api-zod";
import { requireCoachAuth, requireClientOwnership } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/coach", requireCoachAuth, async (req, res) => {
  try {
    const actor = req.actor;
    const coachId = actor?.type === "coach" ? actor.coach.id : -1;
    const clients = await db.select().from(clientsTable)
      .where(eq(clientsTable.coachId, coachId))
      .orderBy(clientsTable.createdAt);
    const clientIds = clients.map(c => c.id);
    const [{ value: activePrograms }] = clientIds.length > 0
      ? await db
          .select({ value: count() })
          .from(programAssignmentsTable)
          .where(inArray(programAssignmentsTable.clientId, clientIds))
      : [{ value: 0 }];

    const clientSummaries = await Promise.all(clients.filter(c => c.status === "active").map(async (c) => {
      const [lastWorkout] = await db.select({ date: workoutLogsTable.createdAt })
        .from(workoutLogsTable)
        .where(eq(workoutLogsTable.clientId, c.id))
        .orderBy(desc(workoutLogsTable.createdAt))
        .limit(1);

      const [{ dueCount }] = await db
        .select({ dueCount: count() })
        .from(assignmentsTable)
        .where(and(eq(assignmentsTable.clientId, c.id), eq(assignmentsTable.status, "pending")));

      const [{ msgCount }] = await db
        .select({ msgCount: count() })
        .from(messagesTable)
        .where(and(eq(messagesTable.clientId, c.id), eq(messagesTable.sender, "client")));

      return {
        clientId: c.id,
        name: c.name,
        lastWorkout: lastWorkout?.date?.toISOString() ?? null,
        lastCheckin: null,
        assignmentsDue: Number(dueCount),
        unreadMessages: Number(msgCount),
      };
    }));

    const recentActivity = clientIds.length > 0
      ? await db.select({
          createdAt: workoutLogsTable.createdAt,
          clientId: workoutLogsTable.clientId,
        })
          .from(workoutLogsTable)
          .where(inArray(workoutLogsTable.clientId, clientIds))
          .orderBy(desc(workoutLogsTable.createdAt))
          .limit(10)
      : [];

    const activity = await Promise.all(recentActivity.map(async (a) => {
      const [client] = await db.select({ name: clientsTable.name })
        .from(clientsTable)
        .where(eq(clientsTable.id, a.clientId));
      return {
        type: "workout",
        clientId: a.clientId,
        clientName: client?.name ?? "Unknown",
        description: "Logged a workout",
        createdAt: a.createdAt.toISOString(),
      };
    }));

    const recentCompleted = clientIds.length > 0
      ? await db.select({
          id: assignmentsTable.id,
          clientId: assignmentsTable.clientId,
          title: assignmentsTable.title,
          type: assignmentsTable.type,
          completedAt: assignmentsTable.completedAt,
          createdAt: assignmentsTable.createdAt,
        })
          .from(assignmentsTable)
          .where(and(
            eq(assignmentsTable.status, "completed"),
            isNotNull(assignmentsTable.completedAt),
            inArray(assignmentsTable.clientId, clientIds),
          ))
          .orderBy(desc(assignmentsTable.completedAt))
          .limit(10)
      : [];

    const completedTasks = await Promise.all(recentCompleted.map(async (a) => {
      const [client] = await db.select({ name: clientsTable.name })
        .from(clientsTable)
        .where(eq(clientsTable.id, a.clientId));
      return {
        id: a.id,
        clientId: a.clientId,
        clientName: client?.name ?? "Unknown",
        title: a.title,
        type: a.type,
        completedAt: a.completedAt?.toISOString() ?? null,
      };
    }));

    res.json({
      totalClients: clients.length,
      activePrograms: Number(activePrograms),
      recentActivity: activity,
      clientSummaries,
      completedTasks,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.get("/dashboard/client/:clientId", requireClientOwnership(), async (req, res) => {
  try {
    const { clientId } = GetClientDashboardParams.parse({ clientId: Number(req.params.clientId) });

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    const recentWorkouts = await db.select().from(workoutLogsTable)
      .where(eq(workoutLogsTable.clientId, clientId))
      .orderBy(desc(workoutLogsTable.createdAt))
      .limit(5);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const [{ wCount }] = await db
      .select({ wCount: count() })
      .from(workoutLogsTable)
      .where(and(eq(workoutLogsTable.clientId, clientId), gte(workoutLogsTable.date, weekStartStr)));

    const [{ pendingCount }] = await db
      .select({ pendingCount: count() })
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.clientId, clientId), eq(assignmentsTable.status, "pending")));

    const [latestMeasurement] = await db.select().from(measurementsTable)
      .where(eq(measurementsTable.clientId, clientId))
      .orderBy(desc(measurementsTable.date))
      .limit(1);

    const measurements = await db.select({
      date: measurementsTable.date,
      weight: measurementsTable.weight,
    })
      .from(measurementsTable)
      .where(and(eq(measurementsTable.clientId, clientId)))
      .orderBy(measurementsTable.date)
      .limit(30);

    const weightHistory = measurements
      .filter(m => m.weight != null)
      .map(m => ({ date: m.date, weight: Number(m.weight) }));

    res.json({
      client: { ...client, createdAt: client.createdAt.toISOString() },
      latestMeasurement: latestMeasurement ? {
        ...latestMeasurement,
        weight: latestMeasurement.weight ? Number(latestMeasurement.weight) : null,
        chest: latestMeasurement.chest ? Number(latestMeasurement.chest) : null,
        waist: latestMeasurement.waist ? Number(latestMeasurement.waist) : null,
        hips: latestMeasurement.hips ? Number(latestMeasurement.hips) : null,
        arms: latestMeasurement.arms ? Number(latestMeasurement.arms) : null,
        thighs: latestMeasurement.thighs ? Number(latestMeasurement.thighs) : null,
        calves: latestMeasurement.calves ? Number(latestMeasurement.calves) : null,
        createdAt: latestMeasurement.createdAt.toISOString(),
      } : null,
      workoutsThisWeek: Number(wCount),
      pendingAssignments: Number(pendingCount),
      recentWorkouts: recentWorkouts.map(w => ({ ...w, createdAt: w.createdAt.toISOString() })),
      weightHistory,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load client dashboard" });
  }
});

export default router;
