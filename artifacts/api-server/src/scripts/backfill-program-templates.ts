import { db, coachesTable, programsTable } from "@workspace/db";
import { instantiateAllProgramTemplatesForCoach } from "../services/program_templates";

/**
 * One-time backfill: instantiate the pre-built program templates for any
 * existing coach who currently has zero programs. Safe to re-run — coaches
 * that already have at least one program (including ones this script already
 * backfilled) are skipped.
 */
async function main() {
  const coaches = await db.select().from(coachesTable);
  const programs = await db.select({ coachId: programsTable.coachId }).from(programsTable);
  const coachIdsWithPrograms = new Set(programs.map(p => p.coachId));

  const coachesToBackfill = coaches.filter(c => !coachIdsWithPrograms.has(c.id));

  console.log(`Found ${coaches.length} coach(es), ${coachesToBackfill.length} with zero programs.`);

  for (const coach of coachesToBackfill) {
    console.log(`Backfilling templates for coach ${coach.id} (${coach.email})...`);
    await instantiateAllProgramTemplatesForCoach(coach.id);
  }

  console.log("Backfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
