---
name: Pre-built program templates
description: How coach-facing "pre-built program" library (Strength/Hypertrophy/Functional/Symmetry/Athletic Performance) is implemented on top of the existing Program/Phase/Day/Exercise schema.
---

Pre-built programs are NOT stored as DB rows / a separate template table. They are static TS data (`artifacts/api-server/src/data/program_templates.ts`) that gets cloned into a normal, fully-owned `programs` row (+ phases/days/exercises) via `POST /program-templates/:key/instantiate`.

**Why:** avoids a parallel "template" schema/CRUD surface and migration; reuses all existing program-editing endpoints/UI as-is once instantiated, satisfying "coach can freely edit after assigning" with zero new edit code.

**How to apply:** when adding/editing template content, only touch the static data file — exercise names referenced there must exactly match rows in the global `exercises` table (case-insensitive lookup with auto-create fallback using the embedded `muscleGroup` if a name doesn't exist). Adding a 6th template category = add another entry to `PROGRAM_TEMPLATES`; no schema change needed.
