import bcrypt from "bcryptjs";
import {
  db,
  coachesTable,
  clientsTable,
} from "@workspace/db";
import { instantiateAllProgramTemplatesForCoach } from "../services/program_templates";

const SALT_ROUNDS = 10;

const COACH = {
  username: "coach",
  password: "coach",
  name: "Alex Coach",
  email: "coach@trak.demo",
};

const CLIENTS = [
  { username: "alex", password: "alex", name: "Alex Johnson", email: "alex@trak.demo", goal: "Build muscle and strength" },
  { username: "sam", password: "sam", name: "Sam Williams", email: "sam@trak.demo", goal: "Lose weight and improve cardio" },
  { username: "jordan", password: "jordan", name: "Jordan Rivera", email: "jordan@trak.demo", goal: "Athletic performance" },
];

async function seed() {
  console.log("Wiping all existing coaches and clients...");

  await db.delete(coachesTable);

  console.log("Creating demo coach...");
  const coachHash = await bcrypt.hash(COACH.password, SALT_ROUNDS);
  const [coach] = await db.insert(coachesTable).values({
    username: COACH.username,
    passwordHash: coachHash,
    name: COACH.name,
    email: COACH.email,
  }).returning();
  console.log(`  Created coach: ${COACH.username} / ${COACH.password} (id=${coach.id})`);

  console.log("Creating demo clients...");
  for (const c of CLIENTS) {
    const hash = await bcrypt.hash(c.password, SALT_ROUNDS);
    const [client] = await db.insert(clientsTable).values({
      coachId: coach.id,
      username: c.username,
      passwordHash: hash,
      name: c.name,
      email: c.email,
      goal: c.goal,
    }).returning();
    console.log(`  Created client: ${c.username} / ${c.password} (id=${client.id})`);
  }

  console.log("Populating 5 pre-built programs for the demo coach...");
  await instantiateAllProgramTemplatesForCoach(coach.id);
  console.log("  Done.");

  console.log("\nSeed complete.");
  console.log("\nDemo credentials:");
  console.log(`  Coach:    coach / coach`);
  console.log(`  Client 1: alex / alex`);
  console.log(`  Client 2: sam / sam`);
  console.log(`  Client 3: jordan / jordan`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
