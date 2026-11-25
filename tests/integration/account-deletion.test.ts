/**
 * Integration tests for deleting an owner's account. Runs only when DATABASE_URL_TEST points at a
 * disposable database (it DROPS and recreates the public schema).
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { deleteOwnerAccount, getAccountSummary, recordTermsAcceptance } from "@/server/actions/account-writes";
import type { ImageBucket } from "@/server/actions/media-writes";
import { generatePublicToken } from "@/lib/tokens";

const url = process.env.DATABASE_URL_TEST;
const NOW = new Date("2026-12-02T12:00:00Z");

describe.skipIf(!url)("account deletion (Postgres)", () => {
  const admin = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(admin, { schema }) as unknown as Db;
  const deletedKeys: string[] = [];
  /** The R2 keys each seeded owner's images use, so assertions do not depend on random ids. */
  const imageKeysOf: Record<string, string[]> = {};
  const bucket: ImageBucket = { put: async () => undefined, delete: async (key) => void deletedKeys.push(key) };

  /** A fully populated owner: business, staff, hours, services, clients, appointments with events, sessions, verification. */
  async function seedOwner(id: string, slug: string) {
    await db.insert(schema.user).values({ id, name: `Dueño ${id}`, email: `${id}@example.com`, emailVerified: true });
    await db.insert(schema.session).values({ id: `s-${id}`, userId: id, token: `tok-${id}`, expiresAt: new Date(NOW.getTime() + 86_400_000) });
    await db.insert(schema.account).values({ id: `a-${id}`, accountId: id, providerId: "credential", userId: id, password: "hash" });
    await db.insert(schema.verification).values({ id: `v-${id}`, identifier: `${id}@example.com`, value: "x", expiresAt: new Date(NOW.getTime() + 86_400_000) });
    const businessId = randomUUID();
    imageKeysOf[id] = [`businesses/${businessId}/logo-abcdefabcdef.webp`, `businesses/${businessId}/cover-abcdefabcdef.jpg`];
    const [biz] = await db
      .insert(schema.businesses)
      .values({ id: businessId, ownerUserId: id, slug, name: `Negocio ${id}`, category: "barbershop", onboardingCompletedAt: NOW, logoUrl: `/media/${imageKeysOf[id][0]}`, coverUrl: `/media/${imageKeysOf[id][1]}` })
      .returning();
    const [staff] = await db.insert(schema.staff).values({ businessId: biz!.id, name: "Staff" }).returning();
    const [svc] = await db.insert(schema.services).values({ businessId: biz!.id, name: "Corte", durationMin: 45 }).returning();
    await db.insert(schema.staffServices).values({ staffId: staff!.id, serviceId: svc!.id });
    await db.insert(schema.availabilityRules).values({ staffId: staff!.id, weekday: 1, startTime: "09:00", endTime: "18:00" });
    await db.insert(schema.availabilityExceptions).values({ staffId: staff!.id, date: "2026-12-25", type: "closed" });
    const [client] = await db.insert(schema.clients).values({ businessId: biz!.id, name: "Ana", phone: "+525512340001", email: "ana@example.com" }).returning();
    const mk = (hours: number, status: "confirmed" | "completed") => {
      const startsAt = new Date(NOW.getTime() + hours * 3_600_000);
      return db
        .insert(schema.appointments)
        .values({ businessId: biz!.id, staffId: staff!.id, serviceId: svc!.id, clientId: client!.id, startsAt, endsAt: new Date(startsAt.getTime() + 2_700_000), blockedUntil: new Date(startsAt.getTime() + 2_700_000), serviceNameSnapshot: "Corte", status, source: "public_link", publicToken: generatePublicToken() })
        .returning({ id: schema.appointments.id })
        .then((r) => r[0]!.id);
    };
    const upcomingId = await mk(48, "confirmed");
    const pastId = await mk(-48, "completed");
    for (const appointmentId of [upcomingId, pastId]) await db.insert(schema.appointmentEvents).values({ appointmentId, type: "created", actor: "client" });
    return { businessId: biz!.id };
  }

  const counts = async () => {
    const q = async (table: string) => (await admin.unsafe(`select count(*)::int as n from "${table}"`))[0]!.n as number;
    const tables = ["user", "session", "account", "verification", "businesses", "staff", "services", "staff_services", "availability_rules", "availability_exceptions", "clients", "appointments", "appointment_events"];
    return Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await q(t)]))) as Record<string, number>;
  };

  beforeAll(async () => {
    await admin.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    deletedKeys.length = 0;
    await admin.unsafe("TRUNCATE appointment_events, appointments, clients, staff_services, availability_exceptions, availability_rules, services, staff, businesses, verification, account, session, \"user\" CASCADE");
  });

  afterAll(async () => {
    await admin.end();
  });

  it("summarizes what would be removed, counting only upcoming active appointments as upcoming", async () => {
    await seedOwner("u1", "negocio-uno");
    expect(await getAccountSummary(db, "u1", NOW)).toEqual({ email: "u1@example.com", businessName: "Negocio u1", clients: 1, appointments: 2, upcoming: 1 });
    expect(await getAccountSummary(db, "missing", NOW)).toBeNull();
  });

  it("removes the owner and everything under them, and deletes both images", async () => {
    await seedOwner("u1", "negocio-uno");
    expect((await counts()).appointments).toBe(2);
    const result = await deleteOwnerAccount(db, bucket, "u1");
    expect(result).toEqual({ ok: true, data: { removedUrls: imageKeysOf.u1!.map((key) => `/media/${key}`) } });
    expect(Object.values(await counts()).every((n) => n === 0)).toBe(true);
    expect([...deletedKeys].sort()).toEqual([...imageKeysOf.u1!].sort());
  });

  it("never touches another owner's data", async () => {
    await seedOwner("u1", "negocio-uno");
    await seedOwner("u2", "negocio-dos");
    const before = await counts();
    await deleteOwnerAccount(db, bucket, "u1");
    const after = await counts();
    for (const table of Object.keys(before)) expect(after[table], table).toBe(before[table]! / 2);
    expect(await getAccountSummary(db, "u2", NOW)).toMatchObject({ businessName: "Negocio u2", clients: 1, appointments: 2 });
    expect([...deletedKeys].sort()).toEqual([...imageKeysOf.u1!].sort()); // only u1's images
  });

  it("an owner who never finished onboarding (no business) can be deleted too", async () => {
    await db.insert(schema.user).values({ id: "u3", name: "Sin negocio", email: "u3@example.com" });
    expect(await getAccountSummary(db, "u3", NOW)).toEqual({ email: "u3@example.com", businessName: null, clients: 0, appointments: 0, upcoming: 0 });
    expect(await deleteOwnerAccount(db, bucket, "u3")).toEqual({ ok: true, data: { removedUrls: [] } });
    expect((await counts()).user).toBe(0);
  });

  it("an unknown owner is 'not found' and nothing is touched", async () => {
    await seedOwner("u1", "negocio-uno");
    const before = await counts();
    expect(await deleteOwnerAccount(db, bucket, "nobody")).toEqual({ ok: false, error: "not_found" });
    expect(await counts()).toEqual(before);
  });

  it("concurrent deletions (double tap): exactly one succeeds, the others are 'not found', no errors", async () => {
    await seedOwner("u1", "negocio-uno");
    const conns = Array.from({ length: 5 }, () => postgres(url ?? "", { max: 2, onnotice: () => {} }));
    try {
      const results = await Promise.all(conns.map((c) => deleteOwnerAccount(drizzle(c, { schema }) as unknown as Db, bucket, "u1")));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.error === "not_found")).toHaveLength(4);
    } finally {
      await Promise.all(conns.map((c) => c.end()));
    }
    expect(Object.values(await counts()).every((n) => n === 0)).toBe(true);
  });

  it("an image that cannot be deleted from R2 does not undo the deletion", async () => {
    await seedOwner("u1", "negocio-uno");
    const failing: ImageBucket = { put: async () => undefined, delete: async () => Promise.reject(new Error("R2 down")) };
    expect((await deleteOwnerAccount(db, failing, "u1")).ok).toBe(true);
    expect(await db.select().from(schema.user).where(eq(schema.user.id, "u1"))).toHaveLength(0);
  });

  describe("terms acceptance (new-version gate)", () => {
    it("stores the accepted version and the time, only for that owner", async () => {
      await seedOwner("u1", "negocio-uno");
      await seedOwner("u2", "negocio-dos");
      expect(await recordTermsAcceptance(db, "u1", "0.2-borrador", NOW)).toBe(true);
      const [one] = await db.select().from(schema.user).where(eq(schema.user.id, "u1"));
      const [two] = await db.select().from(schema.user).where(eq(schema.user.id, "u2"));
      expect(one?.termsVersion).toBe("0.2-borrador");
      expect(one?.termsAcceptedAt?.toISOString()).toBe(NOW.toISOString());
      expect(two?.termsVersion).toBeNull();
    });

    it("replaces an older accepted version", async () => {
      await seedOwner("u1", "negocio-uno");
      await recordTermsAcceptance(db, "u1", "0.1-borrador", NOW);
      await recordTermsAcceptance(db, "u1", "0.2-borrador", new Date(NOW.getTime() + 1000));
      const [row] = await db.select().from(schema.user).where(eq(schema.user.id, "u1"));
      expect(row?.termsVersion).toBe("0.2-borrador");
    });

    it("reports false for an unknown user", async () => {
      expect(await recordTermsAcceptance(db, "nobody", "0.2-borrador", NOW)).toBe(false);
    });
  });
});
