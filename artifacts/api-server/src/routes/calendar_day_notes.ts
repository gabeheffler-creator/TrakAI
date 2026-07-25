import { Router } from "express";
import { db } from "@workspace/db";
import { calendarDayNotesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListCalendarDayNotesParams,
  CreateCalendarDayNoteParams,
  CreateCalendarDayNoteBody,
  UpdateCalendarDayNoteParams,
  UpdateCalendarDayNoteBody,
  DeleteCalendarDayNoteParams,
} from "@workspace/api-zod";
import { requireClientOwnership, requireCoachOnly, requireClientAuth } from "../middlewares/auth";

const router = Router();

const toJSON = (n: typeof calendarDayNotesTable.$inferSelect) => ({
  ...n,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

// ── Coach: list all notes for a client ──────────────────────────────────────
router.get(
  "/clients/:clientId/calendar-day-notes",
  requireClientOwnership(),
  requireCoachOnly,
  async (req, res) => {
    try {
      const { clientId } = ListCalendarDayNotesParams.parse({ clientId: Number(req.params.clientId) });
      const notes = await db.select().from(calendarDayNotesTable)
        .where(eq(calendarDayNotesTable.clientId, clientId))
        .orderBy(calendarDayNotesTable.date);
      res.json(notes.map(toJSON));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to list calendar day notes" });
    }
  }
);

// ── Coach: create a note ─────────────────────────────────────────────────────
router.post(
  "/clients/:clientId/calendar-day-notes",
  requireClientOwnership(),
  requireCoachOnly,
  async (req, res) => {
    try {
      const { clientId } = CreateCalendarDayNoteParams.parse({ clientId: Number(req.params.clientId) });
      const body = CreateCalendarDayNoteBody.parse(req.body);
      const [note] = await db.insert(calendarDayNotesTable).values({ clientId, date: body.date, note: body.note }).returning();
      res.status(201).json(toJSON(note));
    } catch (err) {
      req.log.error(err);
      res.status(400).json({ error: "Failed to create calendar day note" });
    }
  }
);

// ── Coach: update a note ─────────────────────────────────────────────────────
router.patch(
  "/clients/:clientId/calendar-day-notes/:noteId",
  requireClientOwnership(),
  requireCoachOnly,
  async (req, res) => {
    try {
      const { clientId, noteId } = UpdateCalendarDayNoteParams.parse({ clientId: Number(req.params.clientId), noteId: Number(req.params.noteId) });
      const body = UpdateCalendarDayNoteBody.parse(req.body);
      const [note] = await db.update(calendarDayNotesTable)
        .set({ note: body.note, updatedAt: new Date() })
        .where(and(eq(calendarDayNotesTable.id, noteId), eq(calendarDayNotesTable.clientId, clientId)))
        .returning();
      if (!note) { res.status(404).json({ error: "Note not found" }); return; }
      res.json(toJSON(note));
    } catch (err) {
      req.log.error(err);
      res.status(400).json({ error: "Failed to update calendar day note" });
    }
  }
);

// ── Coach: delete a note ─────────────────────────────────────────────────────
router.delete(
  "/clients/:clientId/calendar-day-notes/:noteId",
  requireClientOwnership(),
  requireCoachOnly,
  async (req, res) => {
    try {
      const { clientId, noteId } = DeleteCalendarDayNoteParams.parse({ clientId: Number(req.params.clientId), noteId: Number(req.params.noteId) });
      await db.delete(calendarDayNotesTable).where(and(eq(calendarDayNotesTable.id, noteId), eq(calendarDayNotesTable.clientId, clientId)));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to delete calendar day note" });
    }
  }
);

// ── Client: read-only list for the logged-in client ──────────────────────────
router.get(
  "/client/calendar-day-notes",
  requireClientAuth,
  async (req, res) => {
    try {
      const clientId = (req as any).clientId as number;
      const notes = await db.select().from(calendarDayNotesTable)
        .where(eq(calendarDayNotesTable.clientId, clientId))
        .orderBy(calendarDayNotesTable.date);
      res.json(notes.map(toJSON));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to list calendar day notes" });
    }
  }
);

export default router;
