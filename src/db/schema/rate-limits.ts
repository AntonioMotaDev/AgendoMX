import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Fixed-window counters for abuse protection (auth endpoints, public booking).
 * Kept in Postgres because the Workers Rate Limiting binding proved too
 * permissive in production. One row per key; see src/db/rate-limit.ts.
 * Keys never contain raw emails or phone numbers (hash them first).
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
    count: integer("count").notNull().default(0),
  },
  (t) => [index("rate_limits_window_start_idx").on(t.windowStart)],
);
