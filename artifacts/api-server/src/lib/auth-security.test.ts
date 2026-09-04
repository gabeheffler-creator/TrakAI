import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canSeedDemoAccounts } from "./demo-gate.js";
import { parseRefreshToken, safeEqualHash, tokenHash } from "./tokens.js";

describe("authentication security primitives", () => {
  it("requires exactly a session id and secret in a refresh token", () => {
    assert.deepEqual(parseRefreshToken("session.secret"), { sessionId: "session", secret: "secret" });
    assert.equal(parseRefreshToken("session"), null);
    assert.equal(parseRefreshToken("session.secret.extra"), null);
  });
  it("compares persisted hashes without accepting mismatches", () => {
    assert.equal(safeEqualHash("a".repeat(64), "a".repeat(64)), true);
    assert.equal(safeEqualHash("a".repeat(64), "b".repeat(64)), false);
    assert.equal(safeEqualHash("a", "aa"), false);
  });
  it("uses an opaque HMAC representation rather than persisting plaintext", () => {
    const token = "native-secret-value";
    const hash = tokenHash(token);
    assert.notEqual(hash, token);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash, tokenHash(token));
  });
  it("never enables demo data in production", () => {
    assert.equal(canSeedDemoAccounts({ NODE_ENV: "production", ENABLE_DEMO_DATA: "true" }), false);
    assert.equal(canSeedDemoAccounts({ NODE_ENV: "development", ENABLE_DEMO_DATA: "true" }), true);
    assert.equal(canSeedDemoAccounts({ NODE_ENV: "development" }), false);
    assert.equal(canSeedDemoAccounts({ NODE_ENV: "test" }), true);
  });
});