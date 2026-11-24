/**
 * Integration tests for owner setup writes. Runs only when DATABASE_URL_TEST
 * points at a disposable database (it DROPS and recreates the public schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { saveBusinessProfile, saveFirstService, saveWeeklySchedule } from "@/server/actions/business-writes";
import { getOnboardingState, getScheduleRules, getPrimaryStaff, isSlugAvailable } from "@/server/queries/business";
import { applyPreset, SCHEDULE_PRESETS } from "@/server/services/schedule";

const url = process.env.DATABASE_URL_TEST;

const businessData = (slug: string) => ({
  name: "Barbería Juan",
  category: "barbershop" as const,
  state: "San Luis Potosí" as const,
  city: "SLP",
  slug,
});

describe.skipIf(!url)("owner setup (Postgres)", () => {
  const client = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  const juan = { id: "u-juan", name: "Juan Pérez" };
  const ana = { id: "u-ana", name: "Ana López" };

  beforeAll(async () => {
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await db.delete(schema.businesses);
    await db.delete(schema.user);
    await db.insert(schema.user).values([
      { id: juan.id, name: juan.name, email: "juan@example.com" },
      { id: ana.id, name: ana.name, email: "ana@example.com" },
    ]);
  });

  afterAll(async () => {
    await client.end();
  });

  it("creates the business with one staff member named after the owner", async () => {
    const result = await saveBusinessProfile(db, juan, businessData("barberia-juan"));
    expect(result.ok).toBe(true);
    const businessId = result.ok ? result.data.id : "";
    const owner = await getPrimaryStaff(db, businessId);
    expect(owner?.name).toBe("Juan Pérez");
    expect(await getOnboardingState(db, juan.id)).toMatchObject({ hasBusiness: true, hasService: false, hasSchedule: false, completed: false });
  });

  it("updates instead of creating a second business when called again", async () => {
    await saveBusinessProfile(db, juan, businessData("barberia-juan"));
    const second = await saveBusinessProfile(db, juan, { ...businessData("barberia-don-juan"), name: "Don Juan" });
    expect(second.ok && second.data.slug).toBe("barberia-don-juan");
    expect(await db.select().from(schema.businesses)).toHaveLength(1);
    expect(await db.select().from(schema.staff)).toHaveLength(1);
  });

  it("a double tap (parallel calls) still yields exactly one business and one staff", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => saveBusinessProfile(db, juan, businessData("barberia-juan"))));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await db.select().from(schema.businesses)).toHaveLength(1);
    expect(await db.select().from(schema.staff)).toHaveLength(1);
  });

  it("two owners racing for the same slug: exactly one wins, the other gets slug_taken", async () => {
    const [a, b] = await Promise.all([
      saveBusinessProfile(db, juan, businessData("el-mejor-corte")),
      saveBusinessProfile(db, ana, businessData("el-mejor-corte")),
    ]);
    const outcomes = [a, b].map((r) => (r.ok ? "ok" : r.error)).sort();
    expect(outcomes).toEqual(["ok", "slug_taken"]);
    expect(await db.select().from(schema.businesses)).toHaveLength(1);
  });

  it("reports slug availability, allowing the owner to keep their own", async () => {
    const created = await saveBusinessProfile(db, juan, businessData("barberia-juan"));
    const id = created.ok ? created.data.id : "";
    expect(await isSlugAvailable(db, "barberia-juan")).toBe(false);
    expect(await isSlugAvailable(db, "barberia-juan", id)).toBe(true);
    expect(await isSlugAvailable(db, "otro-link")).toBe(true);
  });

  it("saves the first service once and links it to the staff", async () => {
    const created = await saveBusinessProfile(db, juan, businessData("barberia-juan"));
    const businessId = created.ok ? created.data.id : "";
    await saveFirstService(db, businessId, { name: "Corte", price: 18000, durationMin: 45 });
    await saveFirstService(db, businessId, { name: "Corte clásico", price: null, durationMin: 60 });
    const rows = await db.select().from(schema.services).where(eq(schema.services.businessId, businessId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Corte clásico", priceCents: null, durationMin: 60 });
    expect(await db.select().from(schema.staffServices)).toHaveLength(1);
  });

  it("replaces the weekly schedule and completes onboarding", async () => {
    const created = await saveBusinessProfile(db, juan, businessData("barberia-juan"));
    const businessId = created.ok ? created.data.id : "";
    await saveFirstService(db, businessId, { name: "Corte", price: 18000, durationMin: 45 });

    expect((await saveWeeklySchedule(db, businessId, applyPreset(SCHEDULE_PRESETS[0]!), { complete: false })).ok).toBe(true);
    expect(await getOnboardingState(db, juan.id)).toMatchObject({ hasSchedule: true, completed: false });

    expect((await saveWeeklySchedule(db, businessId, applyPreset(SCHEDULE_PRESETS[1]!), { complete: true })).ok).toBe(true);
    const owner = await getPrimaryStaff(db, businessId);
    const rules = await getScheduleRules(db, owner!.id);
    expect(rules).toHaveLength(6); // Monday–Saturday, replaced (not appended)
    expect(await getOnboardingState(db, juan.id)).toMatchObject({ completed: true });
  });

  it("keeps the original completion time when the schedule is saved again", async () => {
    const created = await saveBusinessProfile(db, juan, businessData("barberia-juan"));
    const businessId = created.ok ? created.data.id : "";
    await saveFirstService(db, businessId, { name: "Corte", price: null, durationMin: 30 });
    await saveWeeklySchedule(db, businessId, applyPreset(SCHEDULE_PRESETS[0]!), { complete: true });
    const [first] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, businessId));
    await saveWeeklySchedule(db, businessId, applyPreset(SCHEDULE_PRESETS[2]!), { complete: true });
    const [second] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, businessId));
    expect(second!.onboardingCompletedAt?.getTime()).toBe(first!.onboardingCompletedAt?.getTime());
  });

  it("refuses to complete without a service, and rejects invalid schedules without touching the old one", async () => {
    const created = await saveBusinessProfile(db, juan, businessData("barberia-juan"));
    const businessId = created.ok ? created.data.id : "";
    const noService = await saveWeeklySchedule(db, businessId, applyPreset(SCHEDULE_PRESETS[0]!), { complete: true });
    expect(noService).toMatchObject({ ok: false, error: "no_service" });

    await saveFirstService(db, businessId, { name: "Corte", price: null, durationMin: 30 });
    await saveWeeklySchedule(db, businessId, applyPreset(SCHEDULE_PRESETS[0]!), { complete: true });
    const bad = await saveWeeklySchedule(db, businessId, { 1: [{ start: "18:00", end: "09:00" }] }, { complete: true });
    expect(bad).toMatchObject({ ok: false, error: "invalid_schedule" });
    const owner = await getPrimaryStaff(db, businessId);
    expect(await getScheduleRules(db, owner!.id)).toHaveLength(5);
  });

  it("rejects social links that are not https at the database level", async () => {
    const created = await saveBusinessProfile(db, juan, businessData("barberia-juan"));
    const businessId = created.ok ? created.data.id : "";
    await expect(
      db.update(schema.businesses).set({ instagramUrl: "javascript:alert(1)" }).where(eq(schema.businesses.id, businessId)),
    ).rejects.toThrow();
    await expect(
      db.update(schema.businesses).set({ instagramUrl: "https://www.instagram.com/juan" }).where(eq(schema.businesses.id, businessId)),
    ).resolves.toBeDefined();
  });
});
