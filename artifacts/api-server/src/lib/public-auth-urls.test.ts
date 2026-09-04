import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const originalBaseUrl = process.env.AUTH_PUBLIC_BASE_URL;

before(() => {
  process.env.AUTH_PUBLIC_BASE_URL = "https://trak.example/";
});

after(() => {
  if (originalBaseUrl === undefined) delete process.env.AUTH_PUBLIC_BASE_URL;
  else process.env.AUTH_PUBLIC_BASE_URL = originalBaseUrl;
});

test("builds absolute recovery and invitation links for deployed artifact routes", async () => {
  const { authPageUrl, clientInviteUrl } = await import("./public-auth-urls");
  assert.equal(
    authPageUrl("coach", "reset-password", "a token"),
    "https://trak.example/reset-password?token=a%20token",
  );
  assert.equal(
    authPageUrl("coach", "verify-email", "verify-token"),
    "https://trak.example/verify-email?token=verify-token",
  );
  assert.equal(
    authPageUrl("client", "reset-password", "reset-token"),
    "https://trak.example/client/reset-password?token=reset-token",
  );
  assert.equal(
    authPageUrl("client", "verify-email", "verify-token"),
    "https://trak.example/client/verify-email?token=verify-token",
  );
  assert.equal(
    clientInviteUrl("invite/token"),
    "https://trak.example/client/join/invite%2Ftoken",
  );
});