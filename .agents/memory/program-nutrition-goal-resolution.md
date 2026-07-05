---
name: Program-based nutrition goal resolution
description: How a client's active daily nutrition/macro goal is resolved from a phased workout program, with legacy fallback.
---

TrakAI resolves a client's currently-active daily nutrition goal (calories/protein/carbs/fat) from their assigned program, not from a single static per-client record.

Resolution order:
1. Find the client's active program assignment (with a `startDate`).
2. Walk the program's phases in order, accumulating `durationWeeks * 7` days, to find which phase the client is currently in based on days elapsed since `startDate`.
3. Within that phase, resolve the active day using the same modulo day-cycling logic as the workout scheduling view (days-elapsed mod cycle length), not a fixed calendar day.
4. If that specific day has a nutrition goal override, use it. Otherwise fall back to the phase's default nutrition goal.
5. If no program-based goal resolves at all (no active assignment, or no goals set anywhere in the program), fall back to the legacy standalone per-client nutrition goal row.

**Why:** Coaches set nutrition goals per-phase (with optional per-day overrides) rather than per-client, so goals should progress automatically as the client advances through a program — mirroring how workout-of-the-day resolution already works. The legacy fallback exists to avoid breaking clients who predate the phase/day nutrition goal feature.

**How to apply:** Any new client-facing surface that needs "today's nutrition target" should reuse this same resolution order rather than reading a per-client goal field directly.
