---
name: Manual Clerk session testing via backend API
description: How to bypass the browser-based e2e testing tool when it is unavailable, using real Clerk sessions for direct API verification.
---

When the `runTest` Playwright-based testing tool is stuck/looping (e.g. repeatedly hitting "Maximum testing iterations" even on a trivial 1-step test), it's an infra-level issue, not a test-plan problem — confirmed by shrinking the plan down to a single login-check step and still failing identically.

As a fallback, real auth flows (including multi-actor flows like coach + client) can be verified directly against the API using genuine Clerk sessions, without a browser:

```js
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const user = await clerkClient.users.createUser({ emailAddress: [email], password, firstName, lastName, skipPasswordChecks: true });
const session = await clerkClient.sessions.createSession({ userId: user.id });
const { jwt } = await clerkClient.sessions.getToken(session.id);
// curl the API with: -H "Authorization: Bearer <jwt>"
```

**Why:** This exercises the exact same `@clerk/express` `getAuth`/`authenticateRequest` path as real browser sessions, so it's a faithful substitute for e2e auth testing when the browser tool itself is broken.

**How to apply:** Always clean up (`clerkClient.users.deleteUser`) and delete any DB rows created this way afterward — these are real Clerk dev-instance users, not sandboxed test fixtures.
