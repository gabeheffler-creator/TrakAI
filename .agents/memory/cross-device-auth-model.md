---
name: Cross-device authentication model
description: Durable transport, revocation, and one-time-token decisions for TrakAI authentication.
---

Web authentication remains an HTTP-only cookie backed by persistent server-side session storage and an application-level device session. Native authentication uses short-lived opaque access tokens plus rotating opaque refresh tokens; only keyed hashes are persisted. If an Authorization header is present, it is authoritative and must never fall back to a cookie. Both transports resolve the same role-aware actor before authorization and ownership checks.

**Why:** This preserves the safer existing browser model while giving native clients independent, revocable device sessions. Database validation makes targeted revocation immediate, refresh replay detectable, and cookie/bearer authorization behavior consistent.

**How to apply:** Register every successful login as an auth session. Rotate refresh credentials transactionally and revoke the device session on replay. Keep reset, verification, and invitation credentials random, hashed, expiring, atomically consumed, and bound to the intended actor. Build emailed links only from the configured public base URL and real artifact routes.