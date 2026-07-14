/**
 * Route-level integration tests for GET /clients/:clientId/nutrition-goal.
 *
 * Dependencies are injected via makeNutritionGoalsRouter() — no module-level
 * mocking or live database required.
 *
 * Run: pnpm --filter @workspace/api-server run test
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import http from "node:http";
import express, { type Request, type Response, type NextFunction } from "express";
import { makeNutritionGoalsRouter, type RouteContext } from "./nutrition_goals.js";

// ── Passthrough auth ───────────────────────────────────────────────────────
const passthroughOwnership: RouteContext["checkOwnership"] =
  () => (_req: Request, _res: Response, next: NextFunction) => next();

// ── Fake pino-style logger (req.log shim) ─────────────────────────────────
const noop = () => {};
const stubLog = {
  level: "warn", fatal: noop, error: noop, warn: noop,
  info: noop, debug: noop, trace: noop, silent: noop,
  child: () => stubLog,
};

function withLog(app: ReturnType<typeof express>) {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>)["log"] = stubLog;
    next();
  });
}

// ── Test HTTP helper ───────────────────────────────────────────────────────
async function get(
  router: ReturnType<typeof makeNutritionGoalsRouter>,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const app = express();
  withLog(app);
  app.use(express.json());
  app.use(router);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://localhost:${port}${path}`);
    const ct = res.headers.get("content-type") ?? "";
    const body = ct.includes("json") ? await res.json() : await res.text();
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ── Goal row factory ───────────────────────────────────────────────────────
type DayType = "training" | "rest" | "any";

function fakeGoal(dayType: DayType) {
  return {
    id: 1,
    clientId: 1,
    dayType,
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 70,
    waterOz: null,
    periodType: "day" as const,
    effectiveWeek: null,
    durationWeeks: null,
    notes: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /clients/:clientId/nutrition-goal — day-type resolution", () => {

  test("workout-log lookup throws → any-day goal is returned (not 500)", async () => {
    const router = makeNutritionGoalsRouter({
      checkOwnership: passthroughOwnership,
      hasWorkout: async () => { throw new Error("simulated DB error"); },
      getGoal: async (_clientId, dayType) => dayType === "any" ? fakeGoal("any") : null,
      getProgram: async () => null,
    });

    const { status, body } = await get(router, "/clients/1/nutrition-goal");

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["dayType"], "any",
      "On workout-log failure the route must skip training/rest and serve the any-day goal");
    assert.equal(b["isTrainingDay"], false);
  });

  test("no workout log for requested date → rest-day goal is served", async () => {
    const router = makeNutritionGoalsRouter({
      checkOwnership: passthroughOwnership,
      hasWorkout: async () => false,
      getGoal: async (_clientId, dayType) => dayType === "rest" ? fakeGoal("rest") : null,
      getProgram: async () => null,
    });

    const { status, body } = await get(router, "/clients/1/nutrition-goal");

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["dayType"], "rest");
    assert.equal(b["isTrainingDay"], false);
  });

  test("workout is logged for requested date → training-day goal is served", async () => {
    const router = makeNutritionGoalsRouter({
      checkOwnership: passthroughOwnership,
      hasWorkout: async () => true,
      getGoal: async (_clientId, dayType) => dayType === "training" ? fakeGoal("training") : null,
      getProgram: async () => null,
    });

    const { status, body } = await get(router, "/clients/1/nutrition-goal");

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["dayType"], "training");
    assert.equal(b["isTrainingDay"], true);
  });

  test("no workout log + no rest goal → any-day fallback is served", async () => {
    const router = makeNutritionGoalsRouter({
      checkOwnership: passthroughOwnership,
      hasWorkout: async () => false, // rest day, but no rest goal configured
      getGoal: async (_clientId, dayType) => dayType === "any" ? fakeGoal("any") : null,
      getProgram: async () => null,
    });

    const { status, body } = await get(router, "/clients/1/nutrition-goal");

    assert.equal(status, 200);
    const b = body as Record<string, unknown>;
    assert.equal(b["dayType"], "any");
    assert.equal(b["isTrainingDay"], false);
  });

  test("no goals configured for client → null response", async () => {
    const router = makeNutritionGoalsRouter({
      checkOwnership: passthroughOwnership,
      hasWorkout: async () => false,
      getGoal: async () => null,
      getProgram: async () => null,
    });

    const { status, body } = await get(router, "/clients/1/nutrition-goal");

    assert.equal(status, 200);
    assert.equal(body, null);
  });

  test("program goal resolution fails → falls through to coach-set any-day goal", async () => {
    const router = makeNutritionGoalsRouter({
      checkOwnership: passthroughOwnership,
      hasWorkout: async () => false,
      getGoal: async (_clientId, dayType) => dayType === "any" ? fakeGoal("any") : null,
      getProgram: async () => { throw new Error("corrupt program assignment"); },
    });

    const { status, body } = await get(router, "/clients/1/nutrition-goal");

    assert.equal(status, 200,
      "Program goal error must not surface as a 500 — fall through to coach goals");
    const b = body as Record<string, unknown>;
    assert.equal(b["dayType"], "any");
  });

});
