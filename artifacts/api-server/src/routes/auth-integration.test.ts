import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import app from "../app";
import { pool } from "@workspace/db";
import { issueActionToken, tokenHash } from "../lib/tokens";

let server: ReturnType<typeof app.listen>;
let baseUrl = "";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const coachUsername = `auth-coach-${suffix}`;
const clientUsername = `auth-client-${suffix}`;
const coachEmail = `${coachUsername}@example.test`;
const clientEmail = `${clientUsername}@example.test`;
const password = "correct-horse-123";
const ids: { coach?: number; client?: number; otherClient?: number; invitedClient?: number } = {};

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

const jsonBody = (value: unknown) => JSON.stringify(value);

before(async () => {
  const passwordHash = await bcrypt.hash(password, 4);
  const coach = await pool.query(
    "insert into coaches (username, password_hash, name, email) values ($1,$2,$3,$4) returning id",
    [coachUsername, passwordHash, "Auth Test Coach", coachEmail],
  );
  ids.coach = coach.rows[0].id;

  const client = await pool.query(
    `insert into clients
       (coach_id, username, password_hash, name, email, email_verification_required)
     values ($1,$2,$3,$4,$5,true) returning id`,
    [ids.coach, clientUsername, passwordHash, "Auth Test Client", clientEmail],
  );
  ids.client = client.rows[0].id;

  const otherClient = await pool.query(
    `insert into clients (coach_id, username, password_hash, name, email)
     values ($1,$2,$3,$4,$5) returning id`,
    [ids.coach, `other-${clientUsername}`, passwordHash, "Other Client", `other-${clientEmail}`],
  );
  ids.otherClient = otherClient.rows[0].id;

  const invitedClient = await pool.query(
    "insert into clients (coach_id, name, email) values ($1,$2,$3) returning id",
    [ids.coach, "Invited Client", `invited-${clientEmail}`],
  );
  ids.invitedClient = invitedClient.rows[0].id;

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (ids.coach) {
    await pool.query("delete from auth_action_tokens where actor_id = any($1::int[])", [
      [ids.coach, ids.client, ids.otherClient, ids.invitedClient].filter(Boolean),
    ]);
    await pool.query("delete from auth_sessions where actor_id = any($1::int[])", [
      [ids.coach, ids.client, ids.otherClient, ids.invitedClient].filter(Boolean),
    ]);
    await pool.query("delete from clients where coach_id=$1", [ids.coach]);
    await pool.query("delete from coaches where id=$1", [ids.coach]);
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("cookie and bearer sessions share secure lifecycle rules", async () => {
  const rejectedCrossOrigin = await request("/api/auth/coach/login", {
    method: "POST",
    headers: { origin: "https://untrusted.example" },
    body: jsonBody({ username: coachUsername, password }),
  });
  assert.equal(rejectedCrossOrigin.status, 403);
  const acceptedSameOrigin = await request("/api/auth/coach/login", {
    method: "POST",
    headers: { origin: baseUrl },
    body: jsonBody({ username: coachUsername, password: "not-the-password" }),
  });
  assert.equal(acceptedSameOrigin.status, 401);

  const cookieLogin = await request("/api/auth/coach/login", {
    method: "POST",
    body: jsonBody({ username: coachUsername, password }),
  });
  assert.equal(cookieLogin.status, 200);
  const cookie = cookieLogin.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("trak_session="));

  const cookieMe = await request("/api/auth/me", { headers: { cookie } });
  assert.equal(cookieMe.status, 200);
  assert.equal(((await cookieMe.json()) as { role: string }).role, "coach");

  const listed = await request("/api/auth/sessions", { headers: { cookie } });
  assert.equal(listed.status, 200);
  const cookieSessions = (await listed.json()) as Array<{ kind: string; current: boolean }>;
  assert.ok(cookieSessions.some((session) => session.kind === "cookie" && session.current));

  const inviteEmail = await request(`/api/clients/${ids.invitedClient}/invite/send-email`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(inviteEmail.status, 200);
  const inviteActions = await pool.query(
    `select count(*)::int as count
     from auth_action_tokens
     where actor_type='client' and actor_id=$1 and purpose='invite_accept' and used_at is null`,
    [ids.invitedClient],
  );
  assert.ok(inviteActions.rows[0].count > 0);

  const unverifiedLogin = await request("/api/auth/token/login", {
    method: "POST",
    body: jsonBody({ role: "client", username: clientUsername, password }),
  });
  assert.equal(unverifiedLogin.status, 403);
  assert.equal(((await unverifiedLogin.json()) as { code: string }).code, "EMAIL_NOT_VERIFIED");

  const verification = await issueActionToken("client", ids.client!, "email_verification");
  const verify = await request("/api/auth/email-verification/confirm", {
    method: "POST",
    body: jsonBody({ token: verification.token }),
  });
  assert.equal(verify.status, 200);
  const verifyAgain = await request("/api/auth/email-verification/confirm", {
    method: "POST",
    body: jsonBody({ token: verification.token }),
  });
  assert.equal(verifyAgain.status, 400);

  const nativeLogin = await request("/api/auth/token/login", {
    method: "POST",
    body: jsonBody({
      role: "client",
      username: clientUsername,
      password,
      deviceLabel: "Integration Test Phone",
    }),
  });
  assert.equal(nativeLogin.status, 200);
  const native = await nativeLogin.json() as {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  };

  const bearerMe = await request("/api/auth/me", {
    headers: { authorization: `Bearer ${native.accessToken}` },
  });
  assert.equal(bearerMe.status, 200);
  assert.equal(((await bearerMe.json()) as { role: string }).role, "client");
  const nativeSessionsResponse = await request("/api/auth/sessions", {
    headers: { authorization: `Bearer ${native.accessToken}` },
  });
  const nativeSessions = await nativeSessionsResponse.json() as Array<{
    id: string;
    device_label: string | null;
    current: boolean;
  }>;
  assert.ok(nativeSessions.some((session) =>
    session.id === native.sessionId
    && session.device_label === "Integration Test Phone"
    && session.current
  ));

  const forbiddenOwnership = await request(`/api/clients/${ids.otherClient}`, {
    headers: { authorization: `Bearer ${native.accessToken}` },
  });
  assert.equal(forbiddenOwnership.status, 403);

  const malformedBearerMustNotFallBack = await request("/api/auth/me", {
    headers: { cookie, authorization: "Bearer invalid-token" },
  });
  assert.equal(malformedBearerMustNotFallBack.status, 401);

  const refresh = await request("/api/auth/token/refresh", {
    method: "POST",
    body: jsonBody({ refreshToken: native.refreshToken }),
  });
  assert.equal(refresh.status, 200);
  const rotated = await refresh.json() as {
    accessToken: string;
    refreshToken: string;
    role: string;
    id: number;
  };
  assert.equal(rotated.role, "client");
  assert.equal(rotated.id, ids.client);

  const replay = await request("/api/auth/token/refresh", {
    method: "POST",
    body: jsonBody({ refreshToken: native.refreshToken }),
  });
  assert.equal(replay.status, 401);
  const replayRevokedFamily = await request("/api/auth/me", {
    headers: { authorization: `Bearer ${rotated.accessToken}` },
  });
  assert.equal(replayRevokedFamily.status, 401);

  const nativeAResponse = await request("/api/auth/token/login", {
    method: "POST",
    body: jsonBody({ role: "coach", username: coachUsername, password }),
  });
  const nativeBResponse = await request("/api/auth/token/login", {
    method: "POST",
    body: jsonBody({ role: "coach", username: coachUsername, password }),
  });
  assert.equal(nativeAResponse.status, 200);
  assert.equal(nativeBResponse.status, 200);
  const nativeA = await nativeAResponse.json() as { accessToken: string; sessionId: string };
  const nativeB = await nativeBResponse.json() as { accessToken: string; sessionId: string };

  const revokeB = await request(`/api/auth/sessions/${nativeB.sessionId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${nativeA.accessToken}` },
  });
  assert.equal(revokeB.status, 204);
  assert.equal((await request("/api/auth/me", {
    headers: { authorization: `Bearer ${nativeB.accessToken}` },
  })).status, 401);

  const nativeCResponse = await request("/api/auth/token/login", {
    method: "POST",
    body: jsonBody({ role: "coach", username: coachUsername, password }),
  });
  const nativeC = await nativeCResponse.json() as { accessToken: string };
  const revokeAll = await request("/api/auth/sessions/revoke-all", {
    method: "POST",
    headers: { authorization: `Bearer ${nativeA.accessToken}` },
  });
  assert.equal(revokeAll.status, 200);
  assert.equal((await request("/api/auth/me", {
    headers: { authorization: `Bearer ${nativeA.accessToken}` },
  })).status, 401);
  assert.equal((await request("/api/auth/me", {
    headers: { authorization: `Bearer ${nativeC.accessToken}` },
  })).status, 401);
});

test("reset and invitation action tokens are atomic, expiring, and single-use", async () => {
  const reset = await issueActionToken("coach", ids.coach!, "password_reset");
  const newPassword = "new-correct-horse-456";
  const resetResponse = await request("/api/auth/password-reset/confirm", {
    method: "POST",
    body: jsonBody({ token: reset.token, password: newPassword }),
  });
  assert.equal(resetResponse.status, 200);
  assert.equal((await request("/api/auth/password-reset/confirm", {
    method: "POST",
    body: jsonBody({ token: reset.token, password: newPassword }),
  })).status, 400);

  const expiredToken = `expired-${suffix}`;
  await pool.query(
    `insert into auth_action_tokens
       (token_hash, actor_type, actor_id, purpose, expires_at)
     values ($1,'coach',$2,'email_verification',now() - interval '1 minute')`,
    [tokenHash(expiredToken), ids.coach],
  );
  assert.equal((await request("/api/auth/email-verification/confirm", {
    method: "POST",
    body: jsonBody({ token: expiredToken }),
  })).status, 400);

  const invite = await issueActionToken("client", ids.invitedClient!, "invite_accept");
  const invitedUsername = `accepted-${suffix}`;
  const accepted = await request(`/api/invite/${invite.token}/register`, {
    method: "POST",
    body: jsonBody({ username: invitedUsername, password: newPassword }),
  });
  assert.equal(accepted.status, 201);
  assert.equal((await request(`/api/invite/${invite.token}/register`, {
    method: "POST",
    body: jsonBody({ username: `${invitedUsername}-again`, password: newPassword }),
  })).status, 400);
  const invited = await pool.query(
    "select coach_id, username, email_verification_required from clients where id=$1",
    [ids.invitedClient],
  );
  assert.equal(invited.rows[0].coach_id, ids.coach);
  assert.equal(invited.rows[0].username, invitedUsername);
  assert.equal(invited.rows[0].email_verification_required, true);
});