import { db } from "@workspace/db";
import { coachSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type CoachNotifEvent = "messages" | "tasks" | "workouts";

const TOGGLE_KEY: Record<CoachNotifEvent, string> = {
  messages: "notifMessages",
  tasks: "notifTasks",
  workouts: "notifWorkouts",
};

/** Returns true if hh:mm (24-h) now falls inside [start, end). Handles overnight ranges. */
function inQuietHours(start: string, end: string): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  // Overnight range (e.g. 22:00–07:00): quiet if cur >= s OR cur < e
  if (s > e) return cur >= s || cur < e;
  // Same-day range (e.g. 09:00–17:00): quiet if s <= cur < e
  return cur >= s && cur < e;
}

/**
 * Returns true if the coach should receive a push notification for the given event.
 * Checks per-event toggles (default true) and quiet hours.
 */
export async function isCoachPushAllowed(
  coachId: number,
  event: CoachNotifEvent,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(coachSettingsTable)
    .where(eq(coachSettingsTable.coachId, coachId))
    .limit(1);

  const settings: Record<string, unknown> = row ? JSON.parse(row.settingsJson) : {};

  // Toggle check — default true when not set
  const toggleKey = TOGGLE_KEY[event];
  if (settings[toggleKey] === false) return false;

  // Quiet hours check
  const start = settings.quietHoursStart as string | undefined;
  const end = settings.quietHoursEnd as string | undefined;
  if (start && end && start !== end && inQuietHours(start, end)) return false;

  return true;
}
