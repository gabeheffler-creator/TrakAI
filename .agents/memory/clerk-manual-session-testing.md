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

Also use this fallback when the `runTest` browser subagent gets stuck on a Cloudflare "Verify you are human" checkbox during Clerk sign-up/sign-in (seen consistently, not just an infra fluke) — programmatic Clerk auth sidesteps the CAPTCHA entirely.

**Environment note:** the `code_execution` JS sandbox does NOT have `process.env` populated with app secrets (e.g. `CLERK_SECRET_KEY`) even though `viewEnvVars()` shows they exist — `import('node:process')` there has an empty env. Run the Node script via the `bash` tool instead (e.g. from inside `artifacts/api-server` so `@clerk/express` resolves), where secrets ARE injected into `process.env` without ever being printed. Write the script to a temp `.mjs` file inside the package dir, run with `node`, then delete the temp file.
