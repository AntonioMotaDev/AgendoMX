import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { E2E_BASE_URL, E2E_DATABASE_URL } from "../../../playwright.config";
import { OWNER_A, OWNER_B, PASSWORD } from "./fixtures";

const maintenanceUrl = E2E_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, "/postgres$1");
const databaseName = new URL(E2E_DATABASE_URL).pathname.slice(1);

/** Refuses to wipe anything that is not clearly a throwaway E2E database. */
function assertDisposable() {
  if (!/e2e|test/i.test(databaseName)) throw new Error(`Refusing to reset "${databaseName}": E2E database names must contain "e2e" or "test".`);
}

async function createOwner(email: string, name: string) {
  const response = await fetch(`${E2E_BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: E2E_BASE_URL },
    body: JSON.stringify({ name, email, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`sign-up failed for ${email}: ${response.status} ${await response.text()}`);
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

    await createOwner(OWNER_A.email, OWNER_A.name);
    await createOwner(OWNER_B.email, OWNER_B.name);
    await sql`update "user" set email_verified = true`;

    for (const biz of [OWNER_A, OWNER_B]) {
      const [business] = await sql<{ id: string }[]>`
        insert into businesses (owner_user_id, slug, name, category, description, whatsapp, address, city, state, confirmation_mode, onboarding_completed_at)
        select id, ${biz.slug}, ${biz.business}, 'barbershop', 'Negocio de prueba para E2E.', '+525512345678', 'Juárez 123', 'Guadalajara', 'Jalisco',
               ${biz.mode}::confirmation_mode, now()
        from "user" where email = ${biz.email} returning id`;
      const [staff] = await sql<{ id: string }[]>`insert into staff (business_id, name) values (${business!.id}, ${biz.name}) returning id`;
      await sql`insert into availability_rules (staff_id, weekday, start_time, end_time) select ${staff!.id}, d, '09:00', '18:00' from generate_series(0, 6) d`;
      for (const [i, service] of biz.services.entries()) {
        const [svc] = await sql<{ id: string }[]>`
          insert into services (business_id, name, duration_min, price_cents, buffer_after_min, sort_order)
          values (${business!.id}, ${service.name}, ${service.minutes}, ${service.priceCents}, ${service.buffer}, ${i}) returning id`;
        await sql`insert into staff_services (staff_id, service_id) values (${staff!.id}, ${svc!.id})`;
      }
    }
  } finally {
    await sql.end();
  }
}
