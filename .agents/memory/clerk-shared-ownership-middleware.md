---
name: Clerk dual-role identity resolution
description: Ordering bug when a Clerk user maps to both a coach and a client record in a shared-ownership middleware.
---

In a multi-role app (e.g. coaches + clients both authenticated via the same Clerk instance), a single Clerk user can end up owning rows in *both* role tables — e.g. a client who also happens to sign in on the coach app gets JIT-provisioned as a coach too. If shared per-resource ownership middleware checks "is this user a coach?" before "is this user the specific resource owner?", the coach branch shadows the correct client-owner branch and returns 404/403 for the user's own resource.

**Why:** JIT role provisioning (any signed-in user becomes a coach on first coach-route hit) is often intentional for self-serve signup, but it silently creates a second role for a user who is unaware of it (e.g. a browser context that briefly touched the wrong app, or a real person who happens to use both roles).

**How to apply:** In shared ownership/authorization middleware, always resolve "does this identity directly own the requested resource" first (by direct foreign key / ownership match), and only fall back to a secondary role's ownership check if the direct check fails. Don't let a secondary/incidental role short-circuit access to a resource the caller directly owns.
