/**
 * Integration tests for schedule exceptions. Runs only when DATABASE_URL_TEST
 * points at a disposable database (it DROPS and recreates the public schema).
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { saveBusinessProfile } from "@/server/actions/business-writes";
import { deleteExceptionDate, saveExceptions } from "@/server/actions/exception-writes";
import { listUpcomingExceptions } from "@/server/queries/schedule";
import { computeAvailability } from "@/server/services/availability";

const url = process.env.DATABASE_URL_TEST;
const today = "2026-12-01";

describe.skipIf(!url)("schedule exceptions (Postgres)", () => {
  const client = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  let a = "";
  let b = "";

  beforeAll(async () => {
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await db.delete(schema.businesses);
    await db.delete(schema.user);
    await db.insert(schema.user).values([
      { id: "u-a", name: "Ana", email: "a@example.com" },
      { id: "u-b", name: "Beto", email: "b@example.com" },
    ]);
    const make = async (owner: { id: string; name: string }, slug: string) => {
      const r = await saveBusinessProfile(db, owner, { name: slug, category: "barbershop", categoryOther: null, state: "Jalisco", city: "GDL", slug });
      return r.ok ? r.data.id : "";
    };
    a = await make({ id: "u-a", name: "Ana" }, "negocio-a");
    b = await make({ id: "u-b", name: "Beto" }, "negocio-b");
  });

  afterAll(async () => {
    await client.end();
  });

  it("closes a range of days, one row per date", async () => {
    const result = await saveExceptions(db, a, { startDate: "2026-12-24", endDate: "2026-12-26", kind: "closed", blocks: [] }, today);
    expect(result).toMatchObject({ ok: true, data: { dates: 3 } });
    const list = await listUpcomingExceptions(db, a, today);
    expect(list.map((d) => [d.date, d.kind])).toEqual([["2026-12-24", "closed"], ["2026-12-25", "closed"], ["2026-12-26", "closed"]]);
  });

  it("stores split special hours and reads them back grouped", async () => {
    await saveExceptions(db, a, { startDate: "2026-12-24", kind: "custom_hours", blocks: [{ start: "16:00", end: "19:00" }, { start: "09:00", end: "13:00" }] }, today);
    const [day] = await listUpcomingExceptions(db, a, today);
    expect(day).toEqual({ date: "2026-12-24", kind: "custom_hours", blocks: [{ start: "09:00", end: "13:00" }, { start: "16:00", end: "19:00" }] });
  });

  it("saving a date again replaces it instead of stacking rows (closed -> special -> closed)", async () => {
    await saveExceptions(db, a, { startDate: "2026-12-24", kind: "closed", blocks: [] }, today);
    await saveExceptions(db, a, { startDate: "2026-12-24", kind: "custom_hours", blocks: [{ start: "10:00", end: "14:00" }] }, today);
    expect(await listUpcomingExceptions(db, a, today)).toEqual([{ date: "2026-12-24", kind: "custom_hours", blocks: [{ start: "10:00", end: "14:00" }] }]);
    await saveExceptions(db, a, { startDate: "2026-12-24", kind: "closed", blocks: [] }, today);
    expect(await listUpcomingExceptions(db, a, today)).toEqual([{ date: "2026-12-24", kind: "closed", blocks: [] }]);
    expect(await db.select().from(schema.availabilityExceptions)).toHaveLength(1);
  });

  it("deletes one date and leaves the others", async () => {
    await saveExceptions(db, a, { startDate: "2026-12-24", endDate: "2026-12-25", kind: "closed", blocks: [] }, today);
    await deleteExceptionDate(db, a, "2026-12-24");
    expect((await listUpcomingExceptions(db, a, today)).map((d) => d.date)).toEqual(["2026-12-25"]);
  });

  it("only lists upcoming dates, hiding the past", async () => {
    await saveExceptions(db, a, { startDate: "2026-12-01", kind: "closed", blocks: [] }, today);
    await saveExceptions(db, a, { startDate: "2026-12-20", kind: "closed", blocks: [] }, today);
    expect((await listUpcomingExceptions(db, a, "2026-12-10")).map((d) => d.date)).toEqual(["2026-12-20"]);
  });

  it("is isolated per business: one never sees or deletes the other's exceptions", async () => {
    await saveExceptions(db, b, { startDate: "2026-12-24", kind: "closed", blocks: [] }, today);
    expect(await listUpcomingExceptions(db, a, today)).toEqual([]);
    await deleteExceptionDate(db, a, "2026-12-24");
    expect(await listUpcomingExceptions(db, b, today)).toHaveLength(1);
  });

  it("refuses invalid input without touching existing data", async () => {
    await saveExceptions(db, a, { startDate: "2026-12-24", kind: "closed", blocks: [] }, today);
    const bad = await saveExceptions(db, a, { startDate: "2026-12-24", kind: "custom_hours", blocks: [{ start: "14:00", end: "10:00" }] }, today);
    expect(bad).toMatchObject({ ok: false, error: "invalid" });
    const past = await saveExceptions(db, a, { startDate: "2026-11-01", kind: "closed", blocks: [] }, today);
    expect(past).toMatchObject({ ok: false, error: "invalid" });
    expect(await listUpcomingExceptions(db, a, today)).toEqual([{ date: "2026-12-24", kind: "closed", blocks: [] }]);
  });

  it("feeds the availability engine: closed day has no slots, special hours replace the weekly rules", async () => {
    const [staff] = await db.select().from(schema.staff).where(eq(schema.staff.businessId, a));
    await db.insert(schema.availabilityRules).values([1, 2, 3, 4, 5].map((weekday) => ({ staffId: staff!.id, weekday, startTime: "09:00", endTime: "18:00" })));
    // 2026-12-07 is a Monday, 2026-12-08 a Tuesday.
    await saveExceptions(db, a, { startDate: "2026-12-07", kind: "closed", blocks: [] }, today);
    await saveExceptions(db, a, { startDate: "2026-12-08", kind: "custom_hours", blocks: [{ start: "10:00", end: "12:00" }] }, today);

    const rules = (await db.select().from(schema.availabilityRules)).map((r) => ({ weekday: r.weekday, startTime: r.startTime, endTime: r.endTime }));
    const exceptions = (await db.select().from(schema.availabilityExceptions)).map((e) =>
      e.type === "closed"
        ? ({ date: e.date, type: "closed" } as const)
        : ({ date: e.date, type: "custom_hours", startTime: e.startTime!, endTime: e.endTime! } as const),
    );
    const days = computeAvailability({
      rules, exceptions, busy: [], durationMin: 60, bufferAfterMin: 0, leadTimeMin: 0, windowDays: 30, timezone: "America/Mexico_City",
      now: new Date("2026-12-01T12:00:00Z"), fromDate: "2026-12-07", toDate: "2026-12-08", slotStepMin: 60,
    });
    const byDate = Object.fromEntries(days.map((d) => [d.date, d.slots.length]));
    expect(byDate["2026-12-07"] ?? 0).toBe(0);
    expect(byDate["2026-12-08"]).toBe(2); // 10:00 and 11:00 only
  });
});
