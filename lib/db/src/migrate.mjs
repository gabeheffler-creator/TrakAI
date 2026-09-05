import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running migrations.");
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: path.join(packageRoot, "migrations") });
  console.log("Database migrations applied successfully.");
} finally {
  await pool.end();
}