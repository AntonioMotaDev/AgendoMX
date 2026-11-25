import postgres from "postgres";
import { E2E_DATABASE_URL } from "../../../playwright.config";

/** A short-lived connection to the E2E database, for fixtures and for asserting what the app wrote. */
export function connect() {
  return postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} });
}

export async function withDb<T>(work: (sql: ReturnType<typeof connect>) => Promise<T>): Promise<T> {
  const sql = connect();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

/** Removes everything tests create (bookings, clients, counters) and keeps the fixtures (owners, businesses, services, hours). */
export async function resetBookings() {
  await withDb((sql) => sql`TRUNCATE appointment_events, appointments, clients, rate_limits CASCADE`);
}

export async function appointmentsOf(slug: string) {
  return withDb(
    (sql) => sql<{ id: string; status: string; source: string; token: string; startsAt: Date; clientName: string; clientEmail: string | null }[]>`
      select a.id, a.status, a.source, a.public_token as token, a.starts_at as "startsAt", c.name as "clientName", c.email as "clientEmail"
      from appointments a join clients c on c.id = a.client_id join businesses b on b.id = a.business_id
      where b.slug = ${slug} order by a.starts_at`,
  );
}

export async function eventsOf(appointmentId: string) {
  return withDb((sql) => sql<{ type: string; actor: string }[]>`select type, actor from appointment_events where appointment_id = ${appointmentId} order by created_at`);
}

/** Inserts an appointment directly (as if a customer had booked earlier), `startsInHours` from now. */
export async function seedAppointment(input: {
  slug: string;
  status: "pending" | "confirmed";
  startsInHours: number;
  clientName?: string;
  phone?: string;
}): Promise<{ id: string; token: string }> {
  const phone = input.phone ?? "+525512340099";
  return withDb(async (sql) => {
    const [row] = await sql<{ id: string; token: string }[]>`
      with biz as (select id from businesses where slug = ${input.slug}),
           st as (select s.id from staff s join biz on s.business_id = biz.id limit 1),
           svc as (select s.id, s.name, s.price_cents from services s join biz on s.business_id = biz.id order by s.sort_order limit 1),
           cl as (
             insert into clients (business_id, name, phone) select biz.id, ${input.clientName ?? "Cliente Sembrado"}, ${phone} from biz
             on conflict (business_id, phone) do update set name = excluded.name returning id
           ),
           ins as (
             insert into appointments (business_id, staff_id, service_id, client_id, starts_at, ends_at, blocked_until, service_name_snapshot, price_cents_snapshot, status, source, public_token, expires_at)
             select biz.id, st.id, svc.id, cl.id,
                    date_trunc('minute', now()) + make_interval(hours => ${input.startsInHours}),
                    date_trunc('minute', now()) + make_interval(hours => ${input.startsInHours}, mins => 45),
                    date_trunc('minute', now()) + make_interval(hours => ${input.startsInHours}, mins => 45),
                    svc.name, svc.price_cents, ${input.status}::appointment_status, 'public_link',
                    substr(md5(random()::text) || md5(random()::text), 1, 32), -- same shape as generatePublicToken(): exactly 32 URL-safe characters
                    case when ${input.status} = 'pending' then now() + interval '1 day' end
             from biz, st, svc, cl returning id, public_token
           )
      select id, public_token as token from ins`;
    return row!;
  });
}
