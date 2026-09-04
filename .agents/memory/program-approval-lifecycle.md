---
name: Program approval lifecycle
description: Backward-compatible approval rules for coach-created workout programs.
---

New coach template programs, whether manual or AI-generated, begin as drafts. A dedicated approval action is the only transition to approved, and every assignment, cloning, synchronization, and client-facing read path must require approved status.

**Why:** Existing assigned and seeded programs predate the review gate and must remain usable, while new programming must never reach a client without deliberate coach review.

**How to apply:** Keep the database default approved for legacy/backfill compatibility, explicitly write draft in every new template creation path, create approved client copies only from approved sources, and include indirect client consumers such as nutrition-goal resolution in visibility audits.