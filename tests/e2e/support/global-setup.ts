import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { E2E_DATABASE_URL } from "../../../playwright.config";
import { OWNER_A, OWNER_B } from "./fixtures";
import { seedOwner } from "./seed";

const maintenanceUrl = E2E_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, "/postgres$1");
const databaseName = new URL(E2E_DATABASE_URL).pathname.slice(1);

/** Refuses to wipe anything that is not clearly a throwaway E2E database. */
function assertDisposable() {
  if (!/e2e|test/i.test(databaseName)) throw new Error(`Refusing to reset "${databaseName}": E2E database names must contain "e2e" or "test".`);
}

/**
 * Fresh schema + two owners (created through the real sign-up so passwords are hashed by
 * Better Auth) + two published businesses. Runs once, after the dev server is up.
 */
export default async function globalSetup() {
  assertDisposable();

  const maintenance = postgres(maintenanceUrl, { max: 1, onnotice: () => {} });
  const exists = await maintenance`select 1 from pg_database where datname = ${databaseName}`;
  if (exists.length === 0) await maintenance.unsafe(`CREATE DATABASE "${databaseName}"`);
  await maintenance.end();

  const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  } finally {
    await sql.end();
  }

  // Owners are created through the running app (real sign-up), each with its own short-lived connection.
  await seedOwner(OWNER_A);
  await seedOwner(OWNER_B);
}
