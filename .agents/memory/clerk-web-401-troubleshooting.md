---
name: Clerk web 401s: don't add token auth
description: For cookie-based web Clerk apps, transient/intermittent 401s from the API should be fixed with client-side retry/error UX, not by wiring bearer-token auth into the web client.
---

Web Clerk apps in this project authenticate via the browser's Clerk session cookie, sent automatically on same-origin requests. `setAuthTokenGetter` / explicit `Authorization: Bearer` handling is only for contexts without a browser cookie jar (e.g. Expo/mobile).

When a coach/client web app shows intermittent 401s from otherwise-correctly-wired endpoints (canonical `clerkMiddleware` + `requireAuth` ordering confirmed against the clerk-auth skill's `setup-and-customization.md`), do not:
- Add `setAuthTokenGetter`, manual `getToken()`, or `Authorization` headers to web fetch code.
- Rework `clerkProxyMiddleware` (it's prod-only and load-bearing; diverging from canonical breaks prod silently).

**Why:** These are explicitly listed as "Dangerous Fixes" in the clerk-auth skill's troubleshoot reference — they don't fix cookie-based 401s and add new failure modes. Underlying transient 401s (e.g. brief session-token refresh races) are often already self-healing via TanStack Query's default retry behavior; the real gap is usually that the UI doesn't distinguish a genuine transient failure from "empty data," so it silently renders as if there's nothing to show.

**How to apply:** When a list/detail view goes silently blank on a 401/error instead of showing feedback, add an explicit `isError` branch with a retry button (`refetch()`) alongside the existing loading/empty states, rather than assuming the auth wiring itself needs to change. Verify with `runTest(..., testClerkAuth: true)` by opening the affected view multiple times in a row to confirm it never renders a blank, unexplained state.
