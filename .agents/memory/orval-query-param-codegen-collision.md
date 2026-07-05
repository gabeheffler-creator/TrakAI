---
name: Orval query-param codegen collision
description: Adding an OpenAPI `in: query` parameter to an endpoint can break the api-zod build with a duplicate-export TS error.
---

Adding a query parameter (`in: query`) to an OpenAPI operation can make orval emit a standalone `<OperationId>Params` type file (in `lib/api-zod/src/generated/types/`) whose name collides with the Zod schema constant of the same name in `lib/api-zod/src/generated/api.ts`. Since `lib/api-zod/src/index.ts` does `export * from "./generated/api"` and `export * from "./generated/types"`, this produces `TS2308: Module has already exported a member named '<OperationId>Params'` and fails `pnpm run typecheck:libs`.

**Why:** This project's OpenAPI spec had zero query parameters before, so the collision hadn't surfaced. It reproduced on the very first endpoint that added one.

**How to apply:** If you hit this error after adding a query param and running codegen, the fastest fix (used here) is to drop the query parameter and bake the default behavior server-side instead (e.g. a fixed trailing-N-days window rather than a `?days=` param). If the query param is genuinely required, you'll need to investigate orval's naming/config options to avoid the collision rather than fighting it ad hoc.
