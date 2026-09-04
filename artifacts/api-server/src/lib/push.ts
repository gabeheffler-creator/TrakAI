import webpush from "web-push";
import { createSign } from "node:crypto";
import * as http2 from "node:http2";
import { db } from "@workspace/db";
import { nativePushTokensTable, pushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { Logger } from "pino";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? "mailto:admin@trakcoach.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

type PushSub = { endpoint: string; p256dh: string; auth: string };
type NativePushToken = { deviceToken: string };
type NativeActor = { type: "coach" | "client"; id: number };

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function apnsConfiguration() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !privateKey) return null;
  return { keyId, teamId, privateKey };
}

function apnsJwt(config: NonNullable<ReturnType<typeof apnsConfiguration>>) {
  const encodedHeader = base64Url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const encodedPayload = base64Url(JSON.stringify({ iss: config.teamId, iat: Math.floor(Date.now() / 1000) }));
  const signer = createSign("SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  const signature = signer.sign({ key: config.privateKey, dsaEncoding: "ieee-p1363" });
  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
}

async function sendApnsNotification(
  token: NativePushToken,
  topic: string,
  payload: string,
  config: NonNullable<ReturnType<typeof apnsConfiguration>>,
): Promise<{ status: number; reason?: string }> {
  const defaultHost = process.env.APNS_ENVIRONMENT === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
  const client = http2.connect(process.env.APNS_HOST ?? defaultHost);
  try {
    const response = await new Promise<{ status: number; reason?: string }>((resolve, reject) => {
      const request = client.request({
        ":method": "POST",
        ":path": `/3/device/${token.deviceToken}`,
        authorization: `bearer ${apnsJwt(config)}`,
        "apns-topic": topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });
      let status = 0;
      let body = "";
      request.on("response", headers => { status = Number(headers[":status"] ?? 0); });
      request.setEncoding("utf8");
      request.on("data", chunk => { body += chunk; });
      request.on("error", reject);
      request.on("end", () => {
        let reason: string | undefined;
        try { reason = body ? JSON.parse(body).reason : undefined; } catch { /* APNs returned a non-JSON error body. */ }
        resolve({ status, reason });
      });
      request.end(payload);
    });
    return response;
  } finally {
    client.close();
  }
}

/**
 * Send APNs notifications to application-owned native devices. APNs is
 * optional so browser Web Push continues to operate without Apple credentials.
 */
export async function sendNativePushToActors(
  actors: NativeActor[],
  payload: { title: string; body: string; eventType: string; route: string; tag?: string },
  log: Logger,
): Promise<void> {
  const config = apnsConfiguration();
  if (!config || actors.length === 0) return;
  await Promise.allSettled(actors.map(async actor => {
    const topic = actor.type === "client"
      ? process.env.APNS_CLIENT_BUNDLE_ID
      : process.env.APNS_COACH_BUNDLE_ID;
    if (!topic) {
      log.warn({ actorType: actor.type }, "APNs bundle ID is not configured");
      return;
    }
    const tokens = await db.select({ deviceToken: nativePushTokensTable.deviceToken })
      .from(nativePushTokensTable)
      .where(and(eq(nativePushTokensTable.actorType, actor.type), eq(nativePushTokensTable.actorId, actor.id)));
    const apnsPayload = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
      eventType: payload.eventType,
      route: payload.route,
      ...(payload.tag ? { tag: payload.tag } : {}),
    });
    await Promise.all(tokens.map(async token => {
      try {
        const { status, reason } = await sendApnsNotification(token, topic, apnsPayload, config);
        if (status === 410 && reason === "Unregistered") {
          await db.delete(nativePushTokensTable).where(eq(nativePushTokensTable.deviceToken, token.deviceToken));
        } else if (status < 200 || status >= 300) {
          log.warn({ status, reason, actorType: actor.type }, "APNs send failed");
        }
      } catch (err) {
        log.warn({ err, actorType: actor.type }, "APNs send failed");
      }
    }));
  }));
}

export async function sendPushToSubs(
  subs: PushSub[],
  payload: string,
  log: Logger,
): Promise<void> {
  await Promise.allSettled(
    subs.map(sub =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 410) {
            await db
              .delete(pushSubscriptionsTable)
              .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
          } else {
            log.warn({ err }, "Push send failed");
          }
        }),
    ),
  );
}
