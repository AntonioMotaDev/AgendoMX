/**
 * Integration tests for erasing a customer's personal data (ARCO). Runs only when DATABASE_URL_TEST
 * points at a disposable database (it DROPS and recreates the public schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { ANONYMIZED_NAME, anonymizeClient } from "@/server/actions/client-writes";
import { getAppointmentByToken } from "@/server/queries/public";
import { listClients } from "@/server/queries/clients";
import { generatePublicToken } from "@/lib/tokens";

const url = process.env.DATABASE_URL_TEST;
const NOW = new Date("2026-12-02T12:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

describe.skipIf(!url)("client erasure (Postgres)", () => {
  const admin = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(admin, { schema }) as unknown as Db;
  let a: { businessId: string; staffId: string; serviceId: string };
  let b: { businessId: string };

  const client = (businessId: string, name: string, phone: string, email: string | null = `${name.toLowerCase()}@example.com`) =>
    db.insert(schema.clients).values({ businessId, name, phone, email, notesShort: "nota" }).returning().then((r) => r[0]!);

  const appt = async (clientId: string, hours: number, status: "confirmed" | "pending" | "completed" | "cancelled") => {
    const startsAt = h(hours);
    const [row] = await db
      .insert(schema.appointments)
      .values({ businessId: a.businessId, staffId: a.staffId, serviceId: a.serviceId, clientId, startsAt, endsAt: new Date(startsAt.getTime() + 2_700_000), blockedUntil: new Date(startsAt.getTime() + 2_700_000), serviceNameSnapshot: "Corte", status, source: "public_link", publicToken: generatePublicToken() })
      .returning();
    return row!;
  };

  beforeAll(async () => {
    await admin.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    await db.insert(schema.user).values([
      { id: "u1", name: "Juan", email: "juan@example.com" },
      { id: "u2", name: "Otro", email: "otro@example.com" },
    ]);
  });

  beforeEach(async () => {
    await admin.unsafe("TRUNCATE appointment_events, appointments, clients, staff_services, services, staff, businesses CASCADE");
    const [biz] = await db.insert(schema.businesses).values({ ownerUserId: "u1", slug: "barberia-juan", name: "Barbería Juan", category: "barbershop", onboardingCompletedAt: NOW }).returning();
    const [staff] = await db.insert(schema.staff).values({ businessId: biz!.id, name: "Juan" }).returning();
    const [svc] = await db.insert(schema.services).values({ businessId: biz!.id, name: "Corte", durationMin: 45 }).returning();
    a = { businessId: biz!.id, staffId: staff!.id, serviceId: svc!.id };
    const [other] = await db.insert(schema.businesses).values({ ownerUserId: "u2", slug: "otro-negocio", name: "Otro", category: "nails" }).returning();
    b = { businessId: other!.id };
  });

  afterAll(async () => {
    await admin.end();
  });

  it("erases name, phone, email and notes; keeps the appointments without personal data", async () => {
    const ana = await client(a.businessId, "Ana", "+525512340001");
    await appt(ana.id, -48, "completed");
    await appt(ana.id, -24, "cancelled");
    const result = await anonymizeClient(db, a.businessId, ana.id, NOW);
    expect(result).toEqual({ ok: true, data: { appointments: 2 } });

    const [row] = await db.select().from(schema.clients).where(eq(schema.clients.id, ana.id));
    expect(row).toMatchObject({ name: ANONYMIZED_NAME, email: null, notesShort: null });
    expect(row!.phone).toMatch(/^\+99\d{10}$/);
    expect(row!.anonymizedAt).toEqual(NOW);
    expect(await db.select().from(schema.appointments).where(eq(schema.appointments.clientId, ana.id))).toHaveLength(2);
  });

  it("rotates private links: a link already sent no longer opens the appointment", async () => {
    const ana = await client(a.businessId, "Ana", "+525512340001");
    const old = await appt(ana.id, -48, "completed");
    expect(await getAppointmentByToken(db, old.publicToken)).not.toBeNull();
    await anonymizeClient(db, a.businessId, ana.id, NOW);
    expect(await getAppointmentByToken(db, old.publicToken)).toBeNull();
    const [after] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, old.id));
    expect(after!.publicToken).not.toBe(old.publicToken);
    expect(after!.publicToken).toHaveLength(32);
  });

  it("refuses while pending or confirmed appointments are still ahead, and changes nothing", async () => {
    for (const status of ["confirmed", "pending"] as const) {
      const person = await client(a.businessId, `Persona ${status}`, status === "confirmed" ? "+525512340010" : "+525512340011");
      await appt(person.id, status === "confirmed" ? 24 : 30, status); // distinct times: the staff cannot be double-booked
      expect(await anonymizeClient(db, a.businessId, person.id, NOW)).toEqual({ ok: false, error: "has_upcoming", upcoming: 1 });
      const [row] = await db.select().from(schema.clients).where(eq(schema.clients.id, person.id));
      expect(row).toMatchObject({ name: `Persona ${status}`, anonymizedAt: null });
    }
  });

  it("past, completed and cancelled appointments do not block", async () => {
    const ana = await client(a.businessId, "Ana", "+525512340001");
    await appt(ana.id, 72, "cancelled");
    await appt(ana.id, -5, "completed");
    expect((await anonymizeClient(db, a.businessId, ana.id, NOW)).ok).toBe(true);
  });

  it("is scoped to the business: another business's client, unknown ids and malformed ids are 'not found'", async () => {
    const theirs = await client(b.businessId, "Ajena", "+525512340002");
    expect(await anonymizeClient(db, a.businessId, theirs.id, NOW)).toEqual({ ok: false, error: "not_found" });
    expect(await anonymizeClient(db, a.businessId, "00000000-0000-4000-8000-000000000000", NOW)).toEqual({ ok: false, error: "not_found" });
    expect(await anonymizeClient(db, a.businessId, "nope", NOW)).toEqual({ ok: false, error: "not_found" });
    expect(await anonymizeClient(db, a.businessId, undefined, NOW)).toEqual({ ok: false, error: "not_found" });
    const [row] = await db.select().from(schema.clients).where(eq(schema.clients.id, theirs.id));
    expect(row).toMatchObject({ name: "Ajena", anonymizedAt: null });
  });

  it("a second erase is reported, and concurrent ones leave exactly one winner", async () => {
    const ana = await client(a.businessId, "Ana", "+525512340001");
    expect((await anonymizeClient(db, a.businessId, ana.id, NOW)).ok).toBe(true);
    expect(await anonymizeClient(db, a.businessId, ana.id, NOW)).toEqual({ ok: false, error: "already_erased" });

    const beto = await client(a.businessId, "Beto", "+525512340003");
    const conns = Array.from({ length: 5 }, () => postgres(url ?? "", { max: 2, onnotice: () => {} }));
    try {
      const results = await Promise.all(conns.map((c) => anonymizeClient(drizzle(c, { schema }) as unknown as Db, a.businessId, beto.id, NOW)));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.error === "already_erased")).toHaveLength(4);
    } finally {
      await Promise.all(conns.map((c) => c.end()));
    }
  });

  it("each erased client gets its own placeholder phone, and the same real person can book again later", async () => {
    const one = await client(a.businessId, "Uno", "+525512340001");
    const two = await client(a.businessId, "Dos", "+525512340002");
    await anonymizeClient(db, a.businessId, one.id, NOW);
    await anonymizeClient(db, a.businessId, two.id, NOW);
    const phones = (await db.select({ phone: schema.clients.phone }).from(schema.clients).where(eq(schema.clients.businessId, a.businessId))).map((r) => r.phone);
    expect(new Set(phones).size).toBe(2);
    // The real number is free again: a new booking by that person creates a fresh client.
    await expect(client(a.businessId, "Uno de nuevo", "+525512340001")).resolves.toBeDefined();
  });

  it("listClients: counts, last appointment, upcoming, scoped to the business, erased people left out", async () => {
    const ana = await client(a.businessId, "Ana", "+525512340001");
    const beto = await client(a.businessId, "Beto", "+525512340002");
    const sin = await client(a.businessId, "Carla", "+525512340003");
    const erased = await client(a.businessId, "Borrada", "+525512340004");
    await client(b.businessId, "De otro negocio", "+525512340005");
    await appt(ana.id, -48, "completed");
    await appt(ana.id, 24, "confirmed");
    await appt(beto.id, -10, "completed");
    await anonymizeClient(db, a.businessId, erased.id, NOW);

    const rows = await listClients(db, a.businessId, NOW);
    expect(rows.map((r) => r.name)).toEqual(["Ana", "Beto", "Carla"]); // most recent appointment first, no-appointment last
    expect(rows[0]).toMatchObject({ appointments: 2, upcoming: 1 });
    expect(rows[0]!.lastAppointmentAt?.toISOString()).toBe(h(24).toISOString());
    expect(rows[1]).toMatchObject({ appointments: 1, upcoming: 0 });
    expect(rows[2]).toMatchObject({ id: sin.id, appointments: 0, upcoming: 0, lastAppointmentAt: null });
    expect(rows.some((r) => r.name === "De otro negocio" || r.name === ANONYMIZED_NAME)).toBe(false);
  });
});
