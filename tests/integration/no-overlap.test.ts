/**
 * Integration test for the appointments_no_overlap EXCLUDE constraint.
 * Runs only when DATABASE_URL_TEST points at a disposable Postgres database
 * (it DROPS and recreates the public schema).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isExclusionViolation } from "@/db/errors";
import * as schema from "@/db/schema";
import { generatePublicToken } from "@/lib/tokens";

const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)("appointments_no_overlap (Postgres)", () => {
  const admin = postgres(url ?? "", { max: 1, onnotice: () => {} });
  const db = drizzle(admin, { schema });
  let ids: { businessId: string; staffId: string; serviceId: string; clientId: string; staff2Id: string };

  beforeAll(async () => {
    await admin.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, { migrationsFolder: "./drizzle" });

    await db.insert(schema.user).values({ id: "u1", name: "Juan", email: "juan@example.com" });
    const [business] = await db
      .insert(schema.businesses)
      .values({ ownerUserId: "u1", slug: "barberia-juan", name: "Barbería Juan", category: "barbershop" })
      .returning();
    const staffRows = await db
      .insert(schema.staff)
      .values([
        { businessId: business!.id, name: "Juan" },
        { businessId: business!.id, name: "Pedro" },
      ])
      .returning();
    const [service] = await db
      .insert(schema.services)
      .values({ businessId: business!.id, name: "Corte", durationMin: 60, bufferAfterMin: 15 })
      .returning();
    const [client] = await db
      .insert(schema.clients)
      .values({ businessId: business!.id, name: "Ana", phone: "+525512345678" })
      .returning();
    ids = {
      businessId: business!.id,
      staffId: staffRows[0]!.id,
      staff2Id: staffRows[1]!.id,
      serviceId: service!.id,
      clientId: client!.id,
    };
  });

  beforeEach(async () => {
    await db.delete(schema.appointments);
  });

  afterAll(async () => {
    await admin.end();
  });

  const appt = (startIso: string, opts: { staffId?: string; status?: typeof schema.appointments.$inferInsert["status"] } = {}) => {
    const startsAt = new Date(startIso);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    const blockedUntil = new Date(endsAt.getTime() + 15 * 60_000);
    return {
      businessId: ids.businessId,
      staffId: opts.staffId ?? ids.staffId,
      serviceId: ids.serviceId,
      clientId: ids.clientId,
      startsAt,
      endsAt,
      blockedUntil,
      serviceNameSnapshot: "Corte",
      status: opts.status ?? "confirmed",
      source: "public_link" as const,
      publicToken: generatePublicToken(),
    };
  };

  it("rejects an overlapping appointment with 23P01", async () => {
    await db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z"));
    const err = await db
      .insert(schema.appointments)
      .values(appt("2026-11-24T15:30:00Z"))
      .then(() => null, (e: unknown) => e);
    expect(isExclusionViolation(err)).toBe(true);
  });

  it("protects the buffer: next booking cannot start before blocked_until", async () => {
    await db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z")); // blocked until 16:15
    const err = await db
      .insert(schema.appointments)
      .values(appt("2026-11-24T16:00:00Z"))
      .then(() => null, (e: unknown) => e);
    expect(isExclusionViolation(err)).toBe(true);
    await expect(db.insert(schema.appointments).values(appt("2026-11-24T16:15:00Z"))).resolves.toBeDefined();
  });

  it("cancelled appointments do not block the slot", async () => {
    await db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z", { status: "cancelled" }));
    await expect(db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z"))).resolves.toBeDefined();
  });

  it.each(["rejected", "expired"] as const)("%s appointments do not block the slot", async (status) => {
    await db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z", { status }));
    await expect(db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z"))).resolves.toBeDefined();
  });

  it("pending appointments block the slot until they are rejected or expire", async () => {
    await db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z", { status: "pending" }));
    const err = await db
      .insert(schema.appointments)
      .values(appt("2026-11-24T15:00:00Z"))
      .then(() => null, (e: unknown) => e);
    expect(isExclusionViolation(err)).toBe(true);
  });

  it("different staff can be booked at the same time", async () => {
    await db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z"));
    await expect(
      db.insert(schema.appointments).values(appt("2026-11-24T15:00:00Z", { staffId: ids.staff2Id })),
    ).resolves.toBeDefined();
  });

  it("two concurrent bookings for the same slot: exactly one wins", async () => {
    const connections = Array.from({ length: 5 }, () => postgres(url ?? "", { max: 1 }));
    try {
      const results = await Promise.allSettled(
        connections.map((c) =>
          drizzle(c, { schema }).transaction((tx) =>
            tx.insert(schema.appointments).values(appt("2026-11-24T18:00:00Z")),
          ),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(ok).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const r of rejected) expect(isExclusionViolation(r.reason)).toBe(true);
    } finally {
      await Promise.all(connections.map((c) => c.end()));
    }
  });
});
