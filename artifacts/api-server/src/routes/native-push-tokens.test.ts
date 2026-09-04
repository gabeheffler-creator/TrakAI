import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import app from "../app";
import { pool } from "@workspace/db";

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const password = "native-push-password";
let coachId: number;
let clientId: number;
let clientAccessToken: string;
let clientRefreshToken: string;
let coachCookie: string;

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

before(async () => {
  const passwordHash = await bcrypt.hash(password, 4);
  const coach = await pool.query(
    "insert into coaches (username, password_hash, name, email) values ($1,$2,$3,$4) returning id",
    [`native-coach-${suffix}`, passwordHash, "Native Coach", `native-coach-${suffix}@example.test`],
  );
  coachId = coach.rows[0].id;
  const client = await pool.query(
    "insert into clients (coach_id, username, password_hash, name, email) values ($1,$2,$3,$4,$5) returning id",
    [coachId, `native-client-${suffix}`, passwordHash, "Native Client", `native-client-${suffix}@example.test`],
  );
  clientId = client.rows[0].id;
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const nativeLogin = await request("/api/auth/token/login", {
    method: "POST",
    headers: { origin: "capacitor://localhost" },
    body: JSON.stringify({ role: "client", username: `native-client-${suffix}`, password }),
  });
  assert.equal(nativeLogin.status, 200);
  const firstTokens = await nativeLogin.json() as { accessToken: string; refreshToken: string };
  const nativeRefresh = await request("/api/auth/token/refresh", {
    method: "POST",
    headers: { origin: "capacitor://localhost" },
    body: JSON.stringify({ refreshToken: firstTokens.refreshToken }),
  });
  assert.equal(nativeRefresh.status, 200);
  const nativeTokens = await nativeRefresh.json() as { accessToken: string; refreshToken: string };
  clientAccessToken = nativeTokens.accessToken;
  clientRefreshToken = nativeTokens.refreshToken;
  const coachLogin = await request("/api/auth/coach/login", {
    method: "POST",
    body: JSON.stringify({ username: `native-coach-${suffix}`, password }),
  });
  coachCookie = coachLogin.headers.get("set-cookie")!.split(";")[0];
});

after(async () => {
  await pool.query("delete from native_push_tokens where actor_id = any($1::int[])", [[coachId, clientId]]);
  await pool.query("delete from auth_sessions where actor_id = any($1::int[])", [[coachId, clientId]]);
  await pool.query("delete from clients where id=$1", [clientId]);
  await pool.query("delete from coaches where id=$1", [coachId]);
  if (server) {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("native push token ownership is derived from bearer or cookie authentication", async () => {
  const preflight = await request("/api/auth/token/login", {
    method: "OPTIONS",
    headers: {
      origin: "capacitor://localhost",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,authorization",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "capacitor://localhost");

  assert.equal((await request("/api/push-tokens", {
    method: "POST",
    body: JSON.stringify({ deviceToken: `unauth-${suffix}` }),
  })).status, 401);

  assert.equal((await request("/api/push-tokens", {
    method: "POST",
    headers: { authorization: `Bearer ${clientAccessToken}` },
    // Unknown ownership fields are ignored; the server uses the bearer actor.
    body: JSON.stringify({ deviceToken: `client-${suffix}`, actorId: coachId, actorType: "coach" }),
  })).status, 201);
  const clientToken = await pool.query(
    "select actor_type, actor_id from native_push_tokens where device_token=$1",
    [`client-${suffix}`],
  );
  assert.deepEqual(clientToken.rows[0], { actor_type: "client", actor_id: clientId });

  assert.equal((await request("/api/push-tokens", {
    method: "POST",
    headers: { cookie: coachCookie },
    body: JSON.stringify({ deviceToken: `coach-${suffix}` }),
  })).status, 201);
  assert.equal((await request("/api/push-tokens", {
    method: "DELETE",
    headers: { authorization: `Bearer ${clientAccessToken}` },
    body: JSON.stringify({ deviceToken: `coach-${suffix}` }),
  })).status, 204);
  const coachToken = await pool.query("select actor_id from native_push_tokens where device_token=$1", [`coach-${suffix}`]);
  assert.equal(coachToken.rows[0].actor_id, coachId);

  assert.equal((await request("/api/auth/token/revoke", {
    method: "POST",
    body: JSON.stringify({ refreshToken: clientRefreshToken, deviceToken: `client-${suffix}` }),
  })).status, 200);
  const removedClientToken = await pool.query("select id from native_push_tokens where device_token=$1", [`client-${suffix}`]);
  assert.equal(removedClientToken.rowCount, 0);
});