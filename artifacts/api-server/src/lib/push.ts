import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? "mailto:admin@trakcoach.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

type PushSub = { endpoint: string; p256dh: string; auth: string };

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
