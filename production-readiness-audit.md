# TrakAI Production-Readiness Audit — Phase 0

**Date:** September 3, 2026  
**Status:** Read-only / No code changes

### Executive Summary
The TrakAI codebase is currently in a state that requires significant hardening before production readiness. While authentication is functionally separated by role, the "mobile" applications are strictly iframe wrappers lacking native lifecycle, security, or deep-link integration. AI features exhibit critical gaps in oversight, particularly regarding automated assignment of programs without review. Furthermore, the API lacks fundamental abuse protection, rate limiting, and robust error handling for external calls.

### 1 Authentication
*   **Demo Accounts:** Seeded via `artifacts/api-server/src/scripts/seed-demo-accounts.ts:32-43`. Passwords are bcrypt-hashed.
*   **Session Management:** Uses `express-session` with `trak_session` cookies; configured as HTTP-only, `SameSite=Lax`, and 7-day max age (`artifacts/api-server/src/app.ts:38-50`). 
*   **Role Separation:** Enforcement is explicit through separate API endpoints, middleware (`artifacts/api-server/src/middlewares/auth.ts:23-42, 44-67`), and client-side context checks.
*   **Validation:** All authenticated routes verify identity against the database; invalid identities receive 401, while inactive clients receive 403 (`artifacts/api-server/src/middlewares/auth.ts:57-59`).

### 2 Mobile Apps
*   **Nature of Artifacts:** Both mobile apps are browser-style iframe wrappers, not native Capacitor applications (`trak-testing-guide.md:11`).
*   **Findings:** The `?mobile=1` query parameter is cosmetic and triggers no code-level changes.
*   **Risks:** There is no native integration for push notifications, deep-linking, or session persistence across the iframe boundary. The current implementation relies on browser-native `service-worker` push, which is insufficient for a native mobile experience.

### 3 AI Features
*   **Integration Sites:** AI functionality is primarily driven by three routes: `POST /api/programs/generate-ai` (`artifacts/api-server/src/routes/programs.ts:198-398`), `GET /api/clients/:clientId/tasks/:taskId/ai-alternatives` (`artifacts/tasks.ts:407-456`), and `POST /api/nutrition/extract` (`artifacts/nutrition_extract.ts:5-69`).
*   **Findings:** All AI calls are synchronous/blocking and rely on `gpt-4o-mini` or `gpt-5-mini`. There is no queueing, batching, or job-based processing for these requests.

### 4 Human Editability of AI/Auto-Computed Values
*   **Findings:**
    *   **Nutrition:** **PASS**. Users can edit extracted values via a pencil action (`artifacts/trak-client/src/pages/nutrition.tsx:169-212`).
    *   **Programs:** **FAIL**. The client-profile flow assigns programs immediately without a review gate (`artifacts/trak-coach/src/pages/client-profile.tsx:942-954`).
    *   **Editing:** **PARTIAL**. While forms exist, UI controls for editing specific day/exercise fields are incomplete or missing (`artifacts/trak-coach/src/pages/program-builder.tsx:443-482, 799-925`).
    *   **Sleep/Workouts:** **FAIL**. No human override exists for auto-reduced workouts (`artifacts/trak-client/src/pages/workout.tsx:1456-1492`).

### 5 Rate Limiting & Abuse Protection
*   **Findings:** There is no rate limiting, throttling, or per-user quota enforcement on any API endpoint (`artifacts/api-server/src`).
*   **Vulnerability:** Unauthenticated endpoints (Invite, Survey, Feedback, Upload URLs) and high-cost AI endpoints are only limited by a global 10MB request cap (`artifacts/api-server/src/app.ts:34-36`).
*   **Recommendation:** Implement request-based rate limiting (e.g., `express-rate-limit`) and explicit validation for all external inputs to prevent resource exhaustion and cost spikes.

### 6 Async/Loading/Error States
*   **Findings:** While loading indicators are generally present, error handling is inconsistent.
*   **Critical Gap:** Nutrition extraction (`/api/nutrition/extract`) silently swallows all errors (`artifacts/trak-client/src/pages/nutrition.tsx:323-346`), providing the user no feedback on failure. Program generation provides toast notifications, but lacks robust timeout/retry logic.

### Recommended Phase 1 Direction
1.  **Architecture:** Discontinue "iframe-only" mobile approach; evaluate Capacitor plugins for native session and push handling.
2.  **Safety:** Implement a "Draft" status for all AI-generated programs, requiring an explicit "Confirm & Assign" action by the coach.
3.  **Security:** Add global rate limiting to all `/api` routes and specifically protect `/api/nutrition/extract` behind user authentication.
4.  **Error Handling:** Standardize API error reporting to ensure the frontend displays meaningful feedback rather than silently failing.

### Approval Gate
Implementation is paused pending user approval.