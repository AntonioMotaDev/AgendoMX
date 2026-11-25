/**
 * Integration tests for the public booking writes. Runs only when
 * DATABASE_URL_TEST points at a disposable database (it DROPS and recreates the public schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { cancelByClient, createManualAppointment, createPublicBooking } from "@/server/actions/booking-writes";
import type { BusinessRow } from "@/server/queries/public";

const url = process.env.DATABASE_URL_TEST;

// Wednesday 2026-12-02, Mexico City is UTC-6 (no DST): 10:00 local = 16:00Z.
const NOW = new Date("2026-12-01T12:00:00Z");
const TEN = new Date("2026-12-02T16:00:00Z");
const at = (hhmmZ: string) => new Date(`2026-12-02T${hhmmZ}:00Z`);

describe.skipIf(!url)("public booking (Postgres)", () => {
  const admin = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(admin, { schema }) as unknown as Db;
  let business: BusinessRow;
  let serviceId = "";
  let otherServiceId = "";

  type Person = { name: string; phone: string; email: string | null };
  const person = (n: number): Person => ({ name: `Cliente ${n}`, phone: `+52551234${String(1000 + n)}`, email: null });
  const book = (start: Date, n = 1, over: { serviceId?: unknown; now?: Date; client?: Person } = {}) =>
    createPublicBooking(db, business, { serviceId: "serviceId" in over ? over.serviceId : serviceId, start, client: over.client ?? person(n), now: over.now ?? NOW });

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
    const [row] = await db
      .insert(schema.businesses)
      .values({ ownerUserId: "u1", slug: "barberia-juan", name: "Barbería Juan", category: "barbershop", onboardingCompletedAt: NOW })
      .returning();
    business = row!;
    const [staff] = await db.insert(schema.staff).values({ businessId: business.id, name: "Juan" }).returning();
    const [svc] = await db
      .insert(schema.services)
      .values({ businessId: business.id, name: "Corte", durationMin: 45, bufferAfterMin: 15, priceCents: 18000 })
      .returning();
    serviceId = svc!.id;
    const [other] = await db.insert(schema.businesses).values({ ownerUserId: "u2", slug: "otro-negocio", name: "Otro", category: "nails" }).returning();
    const [foreign] = await db.insert(schema.services).values({ businessId: other!.id, name: "Ajeno", durationMin: 30 }).returning();
    otherServiceId = foreign!.id;
    // Open every day 09:00-18:00 local.
    await db.insert(schema.availabilityRules).values(
      Array.from({ length: 7 }, (_, weekday) => ({ staffId: staff!.id, weekday, startTime: "09:00", endTime: "18:00" })),
    );
  });

  afterAll(async () => {
    await admin.end();
  });

  it("books a slot: confirmed, snapshots, event and a 32+ char token", async () => {
    const r = await book(TEN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.status).toBe("confirmed");
    expect(r.data.publicToken.length).toBeGreaterThanOrEqual(32);
    const [row] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, r.data.appointmentId));
    expect(row?.serviceNameSnapshot).toBe("Corte");
    expect(row?.priceCentsSnapshot).toBe(18000);
    expect(row?.endsAt.toISOString()).toBe("2026-12-02T16:45:00.000Z");
    expect(row?.blockedUntil.toISOString()).toBe("2026-12-02T17:00:00.000Z");
    expect(row?.source).toBe("public_link");
    const events = await db.select().from(schema.appointmentEvents).where(eq(schema.appointmentEvents.appointmentId, r.data.appointmentId));
    expect(events.map((e) => [e.type, e.actor])).toEqual([["created", "client"]]);
  });

  it("manual mode creates a pending request that still blocks the slot", async () => {
    await db.update(schema.businesses).set({ confirmationMode: "manual", pendingExpiryHours: 12 }).where(eq(schema.businesses.id, business.id));
    business = { ...business, confirmationMode: "manual", pendingExpiryHours: 12 };
    const r = await book(TEN);
    expect(r.ok && r.data.status).toBe("pending");
    const [row] = await db.select().from(schema.appointments);
    expect(row?.expiresAt?.toISOString()).toBe("2026-12-02T00:00:00.000Z");
    expect(await book(TEN, 2)).toEqual({ ok: false, error: "slot_taken" });
  });

  it("refuses a slot the engine does not offer: outside hours, off-grid, too soon, beyond the window", async () => {
    expect(await book(at("03:00"))).toEqual({ ok: false, error: "slot_taken" }); // 21:00 local the day before
    expect(await book(at("16:07"))).toEqual({ ok: false, error: "slot_taken" }); // off the 15-min grid
    expect(await book(TEN, 1, { now: new Date("2026-12-02T15:30:00Z") })).toEqual({ ok: false, error: "slot_taken" }); // lead time 60 min
    expect(await book(new Date("2027-03-02T16:00:00Z"))).toEqual({ ok: false, error: "slot_taken" }); // past 30 days
  });

  it("respects the buffer: the next slot opens at blocked_until", async () => {
    expect((await book(TEN)).ok).toBe(true); // 10:00-10:45, blocked until 11:00 local
    expect(await book(at("16:45"), 2)).toEqual({ ok: false, error: "slot_taken" });
    expect((await book(at("17:00"), 3)).ok).toBe(true);
  });

  it("refuses services of another business, inactive services and malformed ids", async () => {
    expect(await book(TEN, 1, { serviceId: otherServiceId })).toEqual({ ok: false, error: "not_found" });
    expect(await book(TEN, 1, { serviceId: "not-a-uuid" })).toEqual({ ok: false, error: "not_found" });
    expect(await book(TEN, 1, { serviceId: undefined })).toEqual({ ok: false, error: "not_found" });
    await db.update(schema.services).set({ isBookableOnline: false }).where(eq(schema.services.id, serviceId));
    expect(await book(TEN)).toEqual({ ok: false, error: "not_found" });
  });

  it("respects closed days and custom hours", async () => {
    const [staff] = await db.select().from(schema.staff);
    await db.insert(schema.availabilityExceptions).values({ staffId: staff!.id, date: "2026-12-02", type: "closed" });
    expect(await book(TEN)).toEqual({ ok: false, error: "slot_taken" });
  });

  it("concurrent bookings of the same slot: exactly one wins, the rest get slot_taken", async () => {
    const conns = Array.from({ length: 8 }, () => postgres(url ?? "", { max: 2, onnotice: () => {} }));
    try {
      const results = await Promise.all(
        conns.map((c, i) =>
          createPublicBooking(drizzle(c, { schema }) as unknown as Db, business, { serviceId, start: TEN, client: person(i), now: NOW }),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.error === "slot_taken")).toHaveLength(7);
      const rows = await db.select().from(schema.appointments);
      expect(rows).toHaveLength(1);
    } finally {
      await Promise.all(conns.map((c) => c.end()));
    }
  });

  it("concurrent bookings of overlapping slots never double-book the staff", async () => {
    const starts = ["16:00", "16:15", "16:30", "16:45", "17:00", "17:15"].map(at);
    const conns = starts.map(() => postgres(url ?? "", { max: 2, onnotice: () => {} }));
    try {
      await Promise.all(
        conns.map((c, i) => createPublicBooking(drizzle(c, { schema }) as unknown as Db, business, { serviceId, start: starts[i]!, client: person(i), now: NOW })),
      );
      const rows = (await db.select().from(schema.appointments)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      expect(rows.length).toBeGreaterThan(0);
      for (let i = 1; i < rows.length; i++) expect(rows[i]!.startsAt.getTime()).toBeGreaterThanOrEqual(rows[i - 1]!.blockedUntil.getTime());
    } finally {
      await Promise.all(conns.map((c) => c.end()));
    }
  });

  it("one phone is one client per business; a later email is kept when the next booking omits it", async () => {
    await book(TEN, 1, { client: { name: "Ana", phone: "+525512340001", email: "ana@example.com" } });
    await book(at("17:00"), 1, { client: { name: "Ana López", phone: "+525512340001", email: null } });
    const rows = await db.select().from(schema.clients).where(eq(schema.clients.businessId, business.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Ana López");
    expect(rows[0]?.email).toBe("ana@example.com");
  });

  it("limits the active upcoming appointments of one phone", async () => {
    for (const t of ["16:00", "17:00", "18:00"]) expect((await book(at(t), 1)).ok).toBe(true);
    expect(await book(at("19:00"), 1)).toEqual({ ok: false, error: "too_many" });
    // Another phone is unaffected.
    expect((await book(at("19:00"), 2)).ok).toBe(true);
  });

  describe("createManualAppointment", () => {
    const manual = (start: Date, over: { offHours?: boolean; serviceId?: unknown; now?: Date; n?: number } = {}) =>
      createManualAppointment(db, business, {
        serviceId: "serviceId" in over ? over.serviceId : serviceId,
        start,
        client: person(over.n ?? 1),
        now: over.now ?? NOW,
        offHours: over.offHours ?? false,
      });

    it("is confirmed at once even when the business approves requests by hand, and logs an owner event", async () => {
      await db.update(schema.businesses).set({ confirmationMode: "manual" }).where(eq(schema.businesses.id, business.id));
      business = { ...business, confirmationMode: "manual" };
      const r = await manual(TEN);
      expect(r.ok && r.data.status).toBe("confirmed");
      if (!r.ok) return;
      const [row] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, r.data.appointmentId));
      expect(row?.source).toBe("manual");
      expect(row?.expiresAt).toBeNull();
      const events = await db.select().from(schema.appointmentEvents).where(eq(schema.appointmentEvents.appointmentId, r.data.appointmentId));
      expect(events.map((e) => [e.type, e.actor])).toEqual([["created", "owner"]]);
    });

    it("ignores the lead time and the per-phone cap, and can use services hidden from the public", async () => {
      expect((await manual(TEN, { now: new Date("2026-12-02T15:50:00Z") })).ok).toBe(true); // 10 minutes ahead
      for (const t of ["17:00", "18:00", "19:00"]) expect((await manual(at(t), { n: 1 })).ok).toBe(true); // 4 for one phone
      await db.update(schema.services).set({ isBookableOnline: false }).where(eq(schema.services.id, serviceId));
      expect((await manual(at("20:00"), { n: 2 })).ok).toBe(true);
    });

    it("refuses inactive, foreign and malformed services", async () => {
      expect(await manual(TEN, { serviceId: otherServiceId })).toEqual({ ok: false, error: "not_found" });
      expect(await manual(TEN, { serviceId: "nope" })).toEqual({ ok: false, error: "not_found" });
      await db.update(schema.services).set({ isActive: false }).where(eq(schema.services.id, serviceId));
      expect(await manual(TEN)).toEqual({ ok: false, error: "not_found" });
    });

    it("engine mode only offers real slots; off-hours mode lets the owner pick any free time", async () => {
      expect(await manual(at("03:00"))).toEqual({ ok: false, error: "slot_taken" }); // 21:00 local, closed
      expect(await manual(at("16:07"))).toEqual({ ok: false, error: "slot_taken" }); // off the grid
      expect((await manual(at("03:00"), { offHours: true })).ok).toBe(true);
      expect((await manual(at("16:07"), { offHours: true, n: 2 })).ok).toBe(true);
    });

    it("never double-books, in either mode", async () => {
      expect((await manual(TEN)).ok).toBe(true);
      expect(await manual(TEN, { n: 2 })).toEqual({ ok: false, error: "slot_taken" });
      expect(await manual(at("16:30"), { offHours: true, n: 2 })).toEqual({ ok: false, error: "slot_taken" }); // overlaps 16:00–17:00 with buffer
      expect((await book(TEN, 3)).ok).toBe(false); // the public flow sees the manual appointment too
    });

    it("off-hours refuses the past (before today) and far-future dates", async () => {
      expect(await manual(new Date("2026-11-30T16:00:00Z"), { offHours: true })).toEqual({ ok: false, error: "slot_taken" });
      expect(await manual(new Date("2028-01-01T16:00:00Z"), { offHours: true })).toEqual({ ok: false, error: "slot_taken" });
      expect((await manual(new Date("2026-12-01T13:00:00Z"), { offHours: true })).ok).toBe(true); // earlier today is fine
    });

    it("concurrent manual and public bookings of one slot: exactly one wins", async () => {
      const conns = Array.from({ length: 6 }, () => postgres(url ?? "", { max: 2, onnotice: () => {} }));
      try {
        const results = await Promise.all(
          conns.map((c, i) => {
            const d = drizzle(c, { schema }) as unknown as Db;
            return i % 2 === 0
              ? createManualAppointment(d, business, { serviceId, start: TEN, client: person(i), now: NOW, offHours: false })
              : createPublicBooking(d, business, { serviceId, start: TEN, client: person(i), now: NOW });
          }),
        );
        expect(results.filter((r) => r.ok)).toHaveLength(1);
      } finally {
        await Promise.all(conns.map((c) => c.end()));
      }
    });
  });

  describe("cancelByClient", () => {
    const makeOne = async () => {
      const r = await book(TEN);
      if (!r.ok) throw new Error("setup failed");
      return r.data;
    };

    it("cancels, logs the event and frees the slot", async () => {
      const a = await makeOne();
      const r = await cancelByClient(db, a.publicToken, NOW);
      expect(r).toEqual({ ok: true, data: { appointmentId: a.appointmentId } });
      const [row] = await db.select().from(schema.appointments);
      expect(row?.status).toBe("cancelled");
      expect(row?.cancelledBy).toBe("client");
      const events = await db.select().from(schema.appointmentEvents).where(eq(schema.appointmentEvents.appointmentId, a.appointmentId));
      expect(events.map((e) => e.type).sort()).toEqual(["cancelled", "created"]);
      expect((await book(TEN, 2)).ok).toBe(true);
    });

    it("a second cancel is refused (status)", async () => {
      const a = await makeOne();
      await cancelByClient(db, a.publicToken, NOW);
      expect(await cancelByClient(db, a.publicToken, NOW)).toEqual({ ok: false, error: "status" });
    });

    it("refuses inside the cancellation window and after the start", async () => {
      const a = await makeOne(); // starts 16:00Z, policy 4 h
      expect(await cancelByClient(db, a.publicToken, new Date("2026-12-02T12:30:00Z"))).toEqual({ ok: false, error: "too_late" });
      expect(await cancelByClient(db, a.publicToken, new Date("2026-12-02T16:00:00Z"))).toEqual({ ok: false, error: "started" });
      const [row] = await db.select().from(schema.appointments);
      expect(row?.status).toBe("confirmed");
    });

    it("an unknown token is not found", async () => {
      expect(await cancelByClient(db, "x".repeat(32), NOW)).toEqual({ ok: false, error: "not_found" });
    });
  });
});
