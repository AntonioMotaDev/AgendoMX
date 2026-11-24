import { sql } from "drizzle-orm";
import type { Db } from "@/db";

export interface RateLimitResult {
  allowed: boolean;
  /** Hits counted in the current window, including this one. */
  count: number;
}

/**
 * Records one hit for `key` and says whether it is within `limit` per window.
 * A single atomic upsert: concurrent requests cannot both read the same count,
 * and an expired window restarts at 1. Fixed windows (a burst can straddle two
 * windows), which is fine for abuse protection.
 */
export async function hitRateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds}) THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds}) THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING count
  `);
  const count = Number(rows[0]?.count ?? 1);
  return { allowed: count <= limit, count };
}

/** Deletes counters whose window ended long ago. Safe to call at any time. */
export async function pruneRateLimits(db: Db, olderThanSeconds = 3600): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - make_interval(secs => ${olderThanSeconds})`);
}
