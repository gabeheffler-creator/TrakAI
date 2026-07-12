import { db, pool } from "@workspace/db";
import {
  programsTable,
  programAssignmentsTable,
  clientsTable,
} from "@workspace/db";
import { cloneProgram } from "@workspace/program-utils";
import { eq, isNull } from "drizzle-orm";

async function main() {
  console.log("Backfilling program assignments to use per-client copies...");

  const stale = await db
    .select({
      assignmentId: programAssignmentsTable.id,
      clientId: programAssignmentsTable.clientId,
      programId: programAssignmentsTable.programId,
      coachId: programsTable.coachId,
    })
    .from(programAssignmentsTable)
    .innerJoin(programsTable, eq(programAssignmentsTable.programId, programsTable.id))
    .where(isNull(programsTable.clientId));

  if (stale.length === 0) {
    console.log("No stale assignments found — nothing to do.");
    await pool.end();
    return;
  }

  console.log(`Found ${stale.length} assignment(s) pointing at template programs.`);

  let migrated = 0;
  let failed = 0;

  for (const row of stale) {
    try {
      await db.transaction(async (tx) => {
        const clonedId = await cloneProgram(tx, row.programId, row.coachId, row.clientId);
        await tx
          .update(programAssignmentsTable)
          .set({ programId: clonedId })
          .where(eq(programAssignmentsTable.id, row.assignmentId));
      });
      const [client] = await db.select({ name: clientsTable.name })
        .from(clientsTable).where(eq(clientsTable.id, row.clientId));
      console.log(`  ✓ Assignment ${row.assignmentId} (client: ${client?.name ?? row.clientId}) → new clone`);
      migrated++;
    } catch (err) {
      console.error(`  ✗ Assignment ${row.assignmentId} failed:`, err);
      failed++;
    }
  }

  console.log(`\nDone: ${migrated} migrated, ${failed} failed.`);
  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
