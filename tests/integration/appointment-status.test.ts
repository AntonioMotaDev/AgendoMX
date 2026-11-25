/**
 * Integration tests for owner appointment actions and agenda queries. Runs only
 * when DATABASE_URL_TEST points at a disposable database (it DROPS the public schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { changeAppointmentStatus } from "@/server/actions/appointment-writes";
import { getOwnerAppointment, listAgenda, listPendingRequests } from "@/server/queries/appointments";
import { generatePublicToken } from "@/lib/tokens";

const url = process.env.DATABASE_URL_TEST;
const NOW = new Date("2026-12-02T12:00:00Z");

describe.skipIf(!url)("owner appointment actions (Postgres)", () => {
  const admin = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(admin, { schema }) as unknown as Db;
  let a: { businessId: string; staffId: string; serviceId: string; clientId: string };
  let b: { businessId: string };

  const appt = (startIso: string, status: typeof schema.appointments.$inferInsert["status"] = "confirmed", over: Partial<typeof schema.appointments.$inferInsert> = {}) => {
    const startsAt = new Date(startIso);
    const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
    return db
      .insert(schema.appointments)
      .values({
        businessId: a.businessId, staffId: a.staffId, serviceId: a.serviceId, clientId: a.clientId,
        startsAt, endsAt, blockedUntil: endsAt, serviceNameSnapshot: "Corte", status,
        source: "public_link", publicToken: generatePublicToken(),
        expiresAt: status === "pending" ? new Date(NOW.getTime() + 86_400_000) : null,
        ...over,
      })
      .returning({ id: schema.appointments.id })
      .then((r) => r[0]!.id);
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
    await db.delete(schema.appointments);
    await db.delete(schema.clients);
    await db.delete(schema.businesses);
    const [biz] = await db.insert(schema.businesses).values({ ownerUserId: "u1", slug: "barberia-juan", name: "Barbería Juan", category: "barbershop", onboardingCompletedAt: NOW }).returning();
    const [staff] = await db.insert(schema.staff).values({ businessId: biz!.id, name: "Juan" }).returning();
    const [svc] = await db.insert(schema.services).values({ businessId: biz!.id, name: "Corte", durationMin: 45 }).returning();
    const [client] = await db.insert(schema.clients).values({ businessId: biz!.id, name: "Ana", phone: "+525512340001", email: "ana@example.com" }).returning();
    a = { businessId: biz!.id, staffId: staff!.id, serviceId: svc!.id, clientId: client!.id };
    const [other] = await db.insert(schema.businesses).values({ ownerUserId: "u2", slug: "otro-negocio", name: "Otro", category: "nails" }).returning();
    b = { businessId: other!.id };
  });

  afterAll(async () => {
    await admin.end();
  });

  const events = (id: string) => db.select().from(schema.appointmentEvents).where(eq(schema.appointmentEvents.appointmentId, id));
  const statusOf = (id: string) => db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).then((r) => r[0]!);

  it("confirming a pending request clears its expiry and logs an owner event", async () => {
    const id = await appt("2026-12-03T16:00:00Z", "pending");
    expect(await changeAppointmentStatus(db, a.businessId, id, "confirm", NOW)).toEqual({ ok: true, data: { event: "confirmed" } });
    const row = await statusOf(id);
    expect(row.status).toBe("confirmed");
    expect(row.expiresAt).toBeNull();
    expect((await events(id)).map((e) => [e.type, e.actor])).toEqual([["confirmed", "owner"]]);
  });

  it("rejecting or cancelling frees the slot and records who cancelled", async () => {
    const r = await appt("2026-12-03T16:00:00Z", "pending");
    const c = await appt("2026-12-03T18:00:00Z", "confirmed");
    expect((await changeAppointmentStatus(db, a.businessId, r, "reject", NOW)).ok).toBe(true);
    expect((await changeAppointmentStatus(db, a.businessId, c, "cancel", NOW)).ok).toBe(true);
    expect((await statusOf(r)).status).toBe("rejected");
    const cancelled = await statusOf(c);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledBy).toBe("business");
    // The freed slot can be booked again (the EXCLUDE constraint ignores non-active statuses).
    await expect(appt("2026-12-03T18:00:00Z")).resolves.toBeDefined();
  });

  it("completed / no_show only after the start", async () => {
    const id = await appt("2026-12-02T16:00:00Z");
    expect(await changeAppointmentStatus(db, a.businessId, id, "complete", NOW)).toEqual({ ok: false, error: "not_started" });
    const later = new Date("2026-12-02T17:00:00Z");
    expect((await changeAppointmentStatus(db, a.businessId, id, "no_show", later)).ok).toBe(true);
    expect((await statusOf(id)).status).toBe("no_show");
  });

  it("a business cannot touch another business's appointment; malformed ids are not found", async () => {
    const id = await appt("2026-12-03T16:00:00Z");
    expect(await changeAppointmentStatus(db, b.businessId, id, "cancel", NOW)).toEqual({ ok: false, error: "not_found" });
    expect(await changeAppointmentStatus(db, a.businessId, "nope", "cancel", NOW)).toEqual({ ok: false, error: "not_found" });
    expect((await statusOf(id)).status).toBe("confirmed");
    expect(await getOwnerAppointment(db, b.businessId, id)).toBeNull();
    expect(await getOwnerAppointment(db, a.businessId, id)).toMatchObject({ clientName: "Ana", clientEmail: "ana@example.com" });
  });

  it("concurrent opposite actions: exactly one wins", async () => {
    const id = await appt("2026-12-03T16:00:00Z", "pending");
    const conns = Array.from({ length: 6 }, () => postgres(url ?? "", { max: 2, onnotice: () => {} }));
    try {
      const results = await Promise.all(
        conns.map((c, i) => changeAppointmentStatus(drizzle(c, { schema }) as unknown as Db, a.businessId, id, i % 2 === 0 ? "confirm" : "reject", NOW)),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.error === "invalid_transition")).toHaveLength(5);
      expect(await events(id)).toHaveLength(1);
    } finally {
      await Promise.all(conns.map((c) => c.end()));
    }
  });

  it("the agenda lists live and closed-out appointments of one business in order, not cancelled ones", async () => {
    await appt("2026-12-02T18:00:00Z");
    await appt("2026-12-02T16:00:00Z", "pending");
    await appt("2026-12-02T20:00:00Z", "cancelled");
    await appt("2026-12-02T22:00:00Z", "completed");
    await appt("2026-12-03T16:00:00Z");
    const day = await listAgenda(db, a.businessId, new Date("2026-12-02T06:00:00Z"), new Date("2026-12-03T06:00:00Z"));
    expect(day.map((x) => x.status)).toEqual(["pending", "confirmed", "completed"]);
    expect(day[0]).toMatchObject({ clientName: "Ana", clientPhone: "+525512340001", serviceName: "Corte" });
    expect(await listAgenda(db, b.businessId, new Date("2026-12-02T06:00:00Z"), new Date("2026-12-03T06:00:00Z"))).toEqual([]);
  });

  it("pending requests are listed across days, only future ones, only for this business", async () => {
    await appt("2026-12-01T10:00:00Z", "pending", { expiresAt: new Date("2026-12-05T00:00:00Z") });
    await appt("2026-12-09T16:00:00Z", "pending");
    await appt("2026-12-04T16:00:00Z", "pending");
    await appt("2026-12-05T16:00:00Z", "confirmed");
    const pending = await listPendingRequests(db, a.businessId, NOW);
    expect(pending.map((p) => p.startsAt.toISOString())).toEqual(["2026-12-04T16:00:00.000Z", "2026-12-09T16:00:00.000Z"]);
    expect(await listPendingRequests(db, b.businessId, NOW)).toEqual([]);
  });
});
