---
name: Orval OpenAPI codegen gotchas
description: Known ways to accidentally break orval's TypeScript codegen when authoring OpenAPI schemas in this repo.
---

Setting `nullable: true` at the top level of an **object** schema (as opposed to on a primitive property) breaks orval's TypeScript generation — it emits invalid syntax like `interface {...} | null`, which fails the codegen build.

**Why:** orval's type generator doesn't handle `nullable` cleanly on inline object schemas; it tries to union an anonymous interface with `null` at the type level, which isn't valid TS syntax on its own.

**How to apply:** When a field can be "absent" (e.g. an optional nested object like a nutrition goal that may not be set), model it as an **optional field that is simply omitted** when unset, not as `nullable: true`. Reserve `nullable` for primitive-typed properties where it does generate correctly.

See also: `orval-query-param-codegen-collision.md` for another orval-specific pitfall (`in: query` params causing duplicate-export collisions — prefer path params).
