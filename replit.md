# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run generate` — generate a reviewed SQL migration after editing `lib/db/src/schema/*`
- `pnpm --filter @workspace/db run migrate` — apply committed migrations to the configured database (manual/non-Replit environments)
- `pnpm --filter @workspace/db run push:dev` — synchronize the development database only; never use for shared or production databases
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

### Database schema workflow

1. Edit the source schema in `lib/db/src/schema/*`.
2. Run `pnpm --filter @workspace/db run generate`.
3. Review the generated SQL and metadata under `lib/db/migrations/`.
4. Commit the schema and migration files together.
5. Task merges continue to synchronize the Replit development database. Replit Publish compares development and production schemas, presents rename/destructive-change confirmations, and applies the production diff.

`push:dev` and `push-force:dev` are local-development tools only. Do not add schema mutation to API startup or deployment build commands. For non-Replit environments, apply the committed migrations explicitly with `pnpm --filter @workspace/db run migrate`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
