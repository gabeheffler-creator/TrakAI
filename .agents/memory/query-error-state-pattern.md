---
name: Query error-state UI pattern
description: Convention used across trak-coach/trak-client for handling failed useList*/useGet* generated hooks so pages don't go silently blank.
---

Pages using generated Orval `useList*`/`useGet*` hooks must handle `isError`, not just `isLoading`. Without this, an API hiccup renders an empty/blank state (e.g. "No data yet") indistinguishable from a genuinely empty result, or leaves the page stuck on a permanent loading spinner.

**Pattern:**
- Destructure `isError`, `refetch`, `isFetching` from the hook alongside `data`/`isLoading` (alias per-hook when a page has multiple lists, e.g. `isError: photosError`).
- Render a shared `QueryErrorState` component when `isError` is true: `<QueryErrorState message="..." onRetry={() => refetch()} isRetrying={isFetching} testId="button-retry-X" />`.
- Guard existing empty-state and list-map JSX with `!isError` so stale/undefined data doesn't render alongside the error UI.
- `QueryErrorState` is duplicated per-app (`trak-coach/src/components/query-error-state.tsx`, `trak-client/src/components/query-error-state.tsx`) rather than a shared lib, since each is a separate leaf workspace artifact per pnpm-workspace conventions (leaf artifacts shouldn't import from each other).
- For pages where the failed fetch is secondary/non-blocking (e.g. a page still allows uploads even if history fails to load), use a non-blocking inline error banner instead of replacing the whole page.

**Why:** A blocking primary fetch (e.g. the object gating which page state to render, like a program assignment or client record) should show a full error+retry screen. A secondary list fetch on an otherwise-functional page should show an inline banner so the rest of the page stays usable.
