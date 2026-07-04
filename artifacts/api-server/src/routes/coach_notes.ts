import { Router } from "express";
import { db } from "@workspace/db";
import { coachNotesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListCoachNotesParams,
  CreateCoachNoteParams,
  CreateCoachNoteBody,
  UpdateCoachNoteParams,
  UpdateCoachNoteBody,
  DeleteCoachNoteParams,
} from "@workspace/api-zod";
import { requireClientOwnership, requireCoachOnly } from "../middlewares/auth";

const router = Router();

router.get("/clients/:clientId/coach-notes", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = ListCoachNotesParams.parse({ clientId: Number(req.params.clientId) });
    const notes = await db.select().from(coachNotesTable)
      .where(eq(coachNotesTable.clientId, clientId))
      .orderBy(coachNotesTable.updatedAt);
    res.json(notes.map(n => ({ ...n, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list coach notes" });
  }
});

router.post("/clients/:clientId/coach-notes", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId } = CreateCoachNoteParams.parse({ clientId: Number(req.params.clientId) });
    const body = CreateCoachNoteBody.parse(req.body);
    const [note] = await db.insert(coachNotesTable).values({ clientId, content: body.content }).returning();
    res.status(201).json({ ...note, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to create note" });
  }
});

router.patch("/clients/:clientId/coach-notes/:noteId", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId, noteId } = UpdateCoachNoteParams.parse({ clientId: Number(req.params.clientId), noteId: Number(req.params.noteId) });
    const body = UpdateCoachNoteBody.parse(req.body);
    const [note] = await db.update(coachNotesTable)
      .set({ content: body.content, updatedAt: new Date() })
      .where(and(eq(coachNotesTable.id, noteId), eq(coachNotesTable.clientId, clientId)))
      .returning();
    if (!note) { res.status(404).json({ error: "Note not found" }); return; }
    res.json({ ...note, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to update note" });
  }
});

router.delete("/clients/:clientId/coach-notes/:noteId", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  try {
    const { clientId, noteId } = DeleteCoachNoteParams.parse({ clientId: Number(req.params.clientId), noteId: Number(req.params.noteId) });
    await db.delete(coachNotesTable).where(and(eq(coachNotesTable.id, noteId), eq(coachNotesTable.clientId, clientId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;
