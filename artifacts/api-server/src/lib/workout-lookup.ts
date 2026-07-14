import { db, workoutLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/**
 * Returns true if the client logged at least one workout on the given date
 * (YYYY-MM-DD). Extracted into its own module so it can be mocked in tests
 * without needing a live database connection.
 */
export async function hasWorkoutOnDate(clientId: number, date: string): Promise<boolean> {
  const logs = await db
    .select({ id: workoutLogsTable.id })
    .from(workoutLogsTable)
    .where(and(eq(workoutLogsTable.clientId, clientId), eq(workoutLogsTable.date, date)))
    .limit(1);
  return logs.length > 0;
}
