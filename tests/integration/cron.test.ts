/**
 * Integration tests for the scheduled jobs. Runs only when DATABASE_URL_TEST
 * points at a disposable database (it DROPS and recreates the public schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { runCronTick } from "@/server/actions/cron-run";
import { claimDueReminders, expirePendingAppointments, pruneExpiredAuthRows, releaseReminders } from "@/server/actions/cron-writes";
import { generatePublicToken } from "@/lib/tokens";

const url = process.env.DATABASE_URL_TEST;
const NOW = new Date("2026-12-02T12:00:00Z");
const h = (hours: number, from = NOW) => new Date(from.getTime() + hours * 3_600_000);

describe.skipIf(!url)("cron jobs (Postgres)", () => {
  const admin = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(admin, { schema }) as unknown as Db;
  let ids: { businessId: string; staffId: string; serviceId: string; withEmail: string; withoutEmail: string };

  const appt = async (over: Partial<typeof schema.appointments.$inferInsert> & { startsIn: number; clientId?: string }) => {
    const startsAt = h(over.startsIn);
    const { startsIn: _s, clientId, ...rest } = over;
    void _s;
    const [row] = await db
      .insert(schema.appointments)
      .values({
        businessId: ids.businessId, staffId: ids.staffId, serviceId: ids.serviceId, clientId: clientId ?? ids.withEmail,
        startsAt, endsAt: h(0.75, startsAt), blockedUntil: h(0.75, startsAt), serviceNameSnapshot: "Corte",
        status: "confirmed", source: "public_link", publicToken: generatePublicToken(),
        createdAt: h(-72), // booked three days ago unless a test says otherwise
        ...rest,
      })
      .returning({ id: schema.appointments.id });
    return row!.id;
  };
  const get = (id: string) => db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).then((r) => r[0]!);

  beforeAll(async () => {
    await admin.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    await db.insert(schema.user).values({ id: "u1", name: "Juan", email: "juan@example.com" });
  });

  beforeEach(async () => {
    await db.delete(schema.appointments);
    await db.delete(schema.clients);
    await db.delete(schema.businesses);
    const [biz] = await db.insert(schema.businesses).values({ ownerUserId: "u1", slug: "barberia-juan", name: "Barbería Juan", category: "barbershop", onboardingCompletedAt: NOW }).returning();
    const [staff] = await db.insert(schema.staff).values({ businessId: biz!.id, name: "Juan" }).returning();
    const [svc] = await db.insert(schema.services).values({ businessId: biz!.id, name: "Corte", durationMin: 45 }).returning();
    const [c1] = await db.insert(schema.clients).values({ businessId: biz!.id, name: "Ana", phone: "+525512340001", email: "ana@example.com" }).returning();
    const [c2] = await db.insert(schema.clients).values({ businessId: biz!.id, name: "Beto", phone: "+525512340002" }).returning();
    ids = { businessId: biz!.id, staffId: staff!.id, serviceId: svc!.id, withEmail: c1!.id, withoutEmail: c2!.id };
  });

  afterAll(async () => {
    await admin.end();
  });

  describe("expirePendingAppointments", () => {
    it("expires overdue pending requests, logs a system event and frees the slot", async () => {
      const late = await appt({ startsIn: 30, status: "pending", expiresAt: h(-1) });
      const fresh = await appt({ startsIn: 60, status: "pending", expiresAt: h(5) });
      const confirmed = await appt({ startsIn: 90, expiresAt: null });
      expect(await expirePendingAppointments(db, NOW)).toBe(1);
      expect((await get(late)).status).toBe("expired");
      expect((await get(fresh)).status).toBe("pending");
      expect((await get(confirmed)).status).toBe("confirmed");
      const events = await db.select().from(schema.appointmentEvents).where(eq(schema.appointmentEvents.appointmentId, late));
      expect(events.map((e) => [e.type, e.actor])).toEqual([["expired", "system"]]);
      await expect(appt({ startsIn: 30 })).resolves.toBeDefined(); // slot is free again
    });

    it("is idempotent and safe to run concurrently", async () => {
      await appt({ startsIn: 30, status: "pending", expiresAt: h(-1) });
      await appt({ startsIn: 60, status: "pending", expiresAt: h(-2) });
      const conns = Array.from({ length: 4 }, () => postgres(url ?? "", { max: 2, onnotice: () => {} }));
      try {
        const counts = await Promise.all(conns.map((c) => expirePendingAppointments(drizzle(c, { schema }) as unknown as Db, NOW)));
        expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
      } finally {
        await Promise.all(conns.map((c) => c.end()));
      }
      expect(await expirePendingAppointments(db, NOW)).toBe(0);
      expect(await db.select().from(schema.appointmentEvents)).toHaveLength(2);
    });
  });

  describe("claimDueReminders", () => {
    it("claims only confirmed appointments with an email inside the window, booked in advance", async () => {
      const due = await appt({ startsIn: 20 });
      await appt({ startsIn: 26 }); // too far
      await appt({ startsIn: 1 }); // too close
      await appt({ startsIn: 18, status: "pending", expiresAt: h(5) });
      await appt({ startsIn: 21, status: "cancelled" });
      await appt({ startsIn: 19, clientId: ids.withoutEmail }); // no email
      await appt({ startsIn: 22, createdAt: h(-1) }); // booked 23 h ahead: it just got its confirmation, no reminder
      const claimed = await claimDueReminders(db, NOW);
      expect(claimed.map((c) => c.id)).toEqual([due]);
      expect(claimed[0]).toMatchObject({ clientEmail: "ana@example.com", clientName: "Ana", serviceName: "Corte", business: { name: "Barbería Juan", category: "barbershop" } });
      expect((await get(due)).reminderSentAt).not.toBeNull();
    });

    it("never claims the same appointment twice, even from concurrent runs", async () => {
      for (const startsIn of [10, 12, 14, 16]) await appt({ startsIn });
      const conns = Array.from({ length: 4 }, () => postgres(url ?? "", { max: 2, onnotice: () => {} }));
      try {
        const batches = await Promise.all(conns.map((c) => claimDueReminders(drizzle(c, { schema }) as unknown as Db, NOW)));
        const all = batches.flat().map((r) => r.id);
        expect(all).toHaveLength(4);
        expect(new Set(all).size).toBe(4);
      } finally {
        await Promise.all(conns.map((c) => c.end()));
      }
      expect(await claimDueReminders(db, NOW)).toEqual([]);
    });

    it("respects the batch size and picks the soonest first", async () => {
      const first = await appt({ startsIn: 5 });
      await appt({ startsIn: 9 });
      await appt({ startsIn: 15 });
      const claimed = await claimDueReminders(db, NOW, 2);
      expect(claimed).toHaveLength(2);
      expect(claimed[0]!.id).toBe(first);
      expect((await claimDueReminders(db, NOW)).length).toBe(1);
    });

    it("released reminders are retried by the next run", async () => {
      const id = await appt({ startsIn: 20 });
      const [claimed] = await claimDueReminders(db, NOW);
      expect(claimed?.id).toBe(id);
      expect(await claimDueReminders(db, NOW)).toEqual([]);
      await releaseReminders(db, [id]);
      expect((await claimDueReminders(db, NOW)).map((c) => c.id)).toEqual([id]);
      await expect(releaseReminders(db, [])).resolves.toBeUndefined();
    });
  });

  describe("runCronTick", () => {
    it("expires, sends due reminders and releases the ones that fail, without stopping the batch", async () => {
      await appt({ startsIn: 30, status: "pending", expiresAt: h(-1) });
      const ok1 = await appt({ startsIn: 6 });
      const bad = await appt({ startsIn: 12 });
      const ok2 = await appt({ startsIn: 18 });
      const sent: string[] = [];
      const summary = await runCronTick(db, NOW, async (r) => {
        if (r.id === bad) throw new Error("provider down");
        sent.push(r.id);
      });
      expect(summary).toEqual({ expired: 1, remindersSent: 2, remindersFailed: 1, sessionsPruned: 0 });
      expect(sent.sort()).toEqual([ok1, ok2].sort());
      expect((await get(bad)).reminderSentAt).toBeNull(); // retried next tick
      expect((await get(ok1)).reminderSentAt).not.toBeNull();
      // Second tick: only the failed one is left.
      const again: string[] = [];
      expect(await runCronTick(db, NOW, async (r) => void again.push(r.id))).toEqual({ expired: 0, remindersSent: 1, remindersFailed: 0, sessionsPruned: 0 });
      expect(again).toEqual([bad]);
    });

    it("prunes old rate-limit counters", async () => {
      await admin.unsafe("INSERT INTO rate_limits (key, window_start, count) VALUES ('old', now() - interval '3 hours', 1), ('new', now(), 1)");
      await runCronTick(db, NOW, async () => {});
      const left = await db.select().from(schema.rateLimits);
      expect(left.map((r) => r.key)).toEqual(["new"]);
    });
  });

  describe("pruneExpiredAuthRows", () => {
    it("deletes sessions and tokens that expired over a day ago, keeping recent and live ones", async () => {
      await db.delete(schema.verification);
      await db.delete(schema.session);
      await db.insert(schema.session).values([
        { id: "old", userId: "u1", token: "t-old", expiresAt: h(-48) },
        { id: "just-expired", userId: "u1", token: "t-just", expiresAt: h(-2) },
        { id: "live", userId: "u1", token: "t-live", expiresAt: h(24 * 20) },
      ]);
      await db.insert(schema.verification).values([
        { id: "v-old", identifier: "a@example.com", value: "x", expiresAt: h(-30) },
        { id: "v-live", identifier: "b@example.com", value: "x", expiresAt: h(1) },
      ]);
      expect(await pruneExpiredAuthRows(db, NOW)).toEqual({ sessions: 1, tokens: 1 });
      expect((await db.select({ id: schema.session.id }).from(schema.session)).map((r) => r.id).sort()).toEqual(["just-expired", "live"]);
      expect((await db.select({ id: schema.verification.id }).from(schema.verification)).map((r) => r.id)).toEqual(["v-live"]);
      expect(await pruneExpiredAuthRows(db, NOW)).toEqual({ sessions: 0, tokens: 0 });
    });
  });
});
