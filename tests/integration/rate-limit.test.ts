/**
 * Integration test for the Postgres-backed rate limiter.
 * Runs only when DATABASE_URL_TEST points at a disposable database
 * (it DROPS and recreates the public schema).
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hitRateLimit, pruneRateLimits } from "@/db/rate-limit";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)("hitRateLimit (Postgres)", () => {
  const client = postgres(url ?? "", { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });

  beforeAll(async () => {
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await db.delete(schema.rateLimits);
  });

  afterAll(async () => {
    await client.end();
  });

  it("allows up to the limit, then blocks", async () => {
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await hitRateLimit(db, "k1", 5, 60)).allowed);
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it("keeps keys independent", async () => {
    for (let i = 0; i < 6; i++) await hitRateLimit(db, "a", 5, 60);
    expect((await hitRateLimit(db, "b", 5, 60)).allowed).toBe(true);
  });

  it("starts a new window once the old one ended", async () => {
    for (let i = 0; i < 6; i++) await hitRateLimit(db, "k2", 5, 60);
    await db.execute(sql`UPDATE rate_limits SET window_start = now() - interval '61 seconds' WHERE key = 'k2'`);
    const result = await hitRateLimit(db, "k2", 5, 60);
    expect(result).toEqual({ allowed: true, count: 1 });
  });

  it("is exact under concurrency: 30 parallel hits, limit 5 -> exactly 5 allowed", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => hitRateLimit(db, "burst", 5, 60)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("prunes only old counters", async () => {
    await hitRateLimit(db, "fresh", 5, 60);
    await hitRateLimit(db, "stale", 5, 60);
    await db.execute(sql`UPDATE rate_limits SET window_start = now() - interval '2 hours' WHERE key = 'stale'`);
    await pruneRateLimits(db, 3600);
    const keys = (await db.select().from(schema.rateLimits)).map((r) => r.key);
    expect(keys).toEqual(["fresh"]);
  });
});
