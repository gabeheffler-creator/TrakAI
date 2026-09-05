---
name: Drizzle migration output path
description: Drizzle Kit 0.31 migration output-path behavior that affects repeatable generation.
---

Use a package-relative migration output path rather than an absolute path.

**Why:** Drizzle Kit 0.31 accepted an absolute output path during initial generation, but later prefixed it with `./` while loading snapshot metadata and failed with a malformed `.//absolute/path` lookup.

**How to apply:** Keep `out` relative to the database package working directory and run generation through the package script so first-time and subsequent generation resolve the same folder.