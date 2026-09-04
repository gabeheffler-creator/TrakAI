import assert from "node:assert/strict";
import { test } from "node:test";
import { AiGatewayError, getAiGatewayConfig, sendAiError } from "./ai-gateway";
import { burstLimit } from "./rate-limit";

test("AI gateway keeps the existing model defaults", () => {
  const original = {
    program: process.env.AI_PROGRAM_MODEL,
    tasks: process.env.AI_TASK_ALTERNATIVES_MODEL,
    nutrition: process.env.AI_NUTRITION_MODEL,
  };
  delete process.env.AI_PROGRAM_MODEL;
  delete process.env.AI_TASK_ALTERNATIVES_MODEL;
  delete process.env.AI_NUTRITION_MODEL;
  try {
    assert.deepEqual(getAiGatewayConfig().models, {
      programGeneration: "gpt-4o-mini",
      taskAlternatives: "gpt-4o-mini",
      nutritionExtraction: "gpt-5-mini",
    });
  } finally {
    if (original.program === undefined) delete process.env.AI_PROGRAM_MODEL; else process.env.AI_PROGRAM_MODEL = original.program;
    if (original.tasks === undefined) delete process.env.AI_TASK_ALTERNATIVES_MODEL; else process.env.AI_TASK_ALTERNATIVES_MODEL = original.tasks;
    if (original.nutrition === undefined) delete process.env.AI_NUTRITION_MODEL; else process.env.AI_NUTRITION_MODEL = original.nutrition;
  }
});

test("AI gateway maps stable client-facing timeout and cap errors", () => {
  for (const scenario of [
    { error: new AiGatewayError("TIMEOUT", "timed out"), status: 504, code: "AI_TIMEOUT" },
    { error: new AiGatewayError("DAILY_LIMIT", "daily cap", 3600), status: 429, code: "AI_DAILY_CAP" },
    { error: new AiGatewayError("UNAVAILABLE", "provider down"), status: 503, code: "AI_PROVIDER_ERROR" },
  ]) {
    let statusCode = 0;
    let body: Record<string, unknown> = {};
    const headers = new Map<string, string>();
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
      status(value: number) {
        statusCode = value;
        return this;
      },
      json(value: Record<string, unknown>) {
        body = value;
        return this;
      },
    };

    assert.equal(sendAiError(response as never, scenario.error), true);
    assert.equal(statusCode, scenario.status);
    assert.equal(body.code, scenario.code);
    if (scenario.error.retryAfter) {
      assert.equal(body.retryAfterSeconds, scenario.error.retryAfter);
      assert.equal(headers.get("Retry-After"), String(scenario.error.retryAfter));
    }
  }
});

test("burst limiter returns the configured AI code and retry delay", () => {
  process.env.TEST_AI_LIMIT_MAX = "1";
  process.env.TEST_AI_LIMIT_WINDOW = "60000";
  const limiter = burstLimit(
    "test-ai",
    "TEST_AI_LIMIT_MAX",
    "TEST_AI_LIMIT_WINDOW",
    { max: 1, windowMs: 60_000 },
    { actorAware: true, code: "AI_BURST_LIMIT" },
  );
  const request = {
    ip: "127.0.0.1",
    actor: { type: "coach", coach: { id: 42 } },
  };
  let nextCalls = 0;
  let statusCode = 0;
  let body: Record<string, unknown> = {};
  const response = {
    setHeader() {},
    status(value: number) {
      statusCode = value;
      return this;
    },
    json(value: Record<string, unknown>) {
      body = value;
      return this;
    },
  };

  limiter(request as never, response as never, () => { nextCalls += 1; });
  limiter(request as never, response as never, () => { nextCalls += 1; });

  assert.equal(nextCalls, 1);
  assert.equal(statusCode, 429);
  assert.equal(body.code, "AI_BURST_LIMIT");
  assert.equal(typeof body.retryAfterSeconds, "number");
  delete process.env.TEST_AI_LIMIT_MAX;
  delete process.env.TEST_AI_LIMIT_WINDOW;
});