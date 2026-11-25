import { E2E_BASE_URL } from "../../../playwright.config";
import { LEGAL_VERSION } from "../../../src/lib/legal-content";
import { PASSWORD } from "./fixtures";
import { withDb } from "./db";

export interface OwnerSpec {
  email: string;
  name: string;
  business: string;
  slug: string;
  mode: "auto" | "manual";
  services: Array<{ name: string; minutes: number; priceCents: number; buffer: number }>;
}

/**
 * A real owner: signed up through Better Auth's own endpoint (so the password is hashed like in
 * production), email marked verified, and a published business with staff, hours and services.
 */
export async function seedOwner(spec: OwnerSpec): Promise<{ businessId: string }> {
  const response = await fetch(`${E2E_BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: E2E_BASE_URL },
    body: JSON.stringify({ name: spec.name, email: spec.email, password: PASSWORD, termsVersion: LEGAL_VERSION }),
  });
  if (!response.ok) throw new Error(`sign-up failed for ${spec.email}: ${response.status} ${await response.text()}`);

  return withDb(async (sql) => {
    await sql`update "user" set email_verified = true where email = ${spec.email}`;
    const [business] = await sql<{ id: string }[]>`
      insert into businesses (owner_user_id, slug, name, category, description, whatsapp, address, city, state, confirmation_mode, onboarding_completed_at)
      select id, ${spec.slug}, ${spec.business}, 'barbershop', 'Negocio de prueba para E2E.', '+525512345678', 'Juárez 123', 'Guadalajara', 'Jalisco',
             ${spec.mode}::confirmation_mode, now()
      from "user" where email = ${spec.email} returning id`;
    const [staff] = await sql<{ id: string }[]>`insert into staff (business_id, name) values (${business!.id}, ${spec.name}) returning id`;
    await sql`insert into availability_rules (staff_id, weekday, start_time, end_time) select ${staff!.id}, d, '09:00', '18:00' from generate_series(0, 6) d`;
    for (const [i, service] of spec.services.entries()) {
      const [svc] = await sql<{ id: string }[]>`
        insert into services (business_id, name, duration_min, price_cents, buffer_after_min, sort_order)
        values (${business!.id}, ${service.name}, ${service.minutes}, ${service.priceCents}, ${service.buffer}, ${i}) returning id`;
      await sql`insert into staff_services (staff_id, service_id) values (${staff!.id}, ${svc!.id})`;
    }
    return { businessId: business!.id };
  });
}
