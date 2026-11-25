import "server-only";
import { getDb } from "@/db";
import { hitRateLimit, pruneRateLimits } from "@/db/rate-limit";
import {
  AUTH_EMAIL_LIMIT,
  AUTH_IP_LIMIT,
  AUTH_WINDOW_SECONDS,
  emailKey,
  extractEmail,
  ipKey,
  matchAuthRule,
} from "@/lib/auth-rate-limit";
import { inBackground } from "@/lib/email/send";

const MAX_BODY_BYTES = 8 * 1024;
/** Share of requests that also clean up old counters. */
const PRUNE_PROBABILITY = 0.02;

/**
 * Applies per-IP and per-email limits to auth requests, backed by Postgres
 * (exact and shared across all Workers). Returns a 429 response when a limit
 * is hit, otherwise null. If the database is unreachable we fail open and log,
 * so a limiter problem can never lock owners out of their accounts.
 */
export async function limitAuthRequest(request: Request): Promise<Response | null> {
  const rule = matchAuthRule(request.method, new URL(request.url).pathname);
  if (!rule) return null;

  try {
    const db = await getDb();
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

    const checks = [hitRateLimit(db, await ipKey(rule, ip), AUTH_IP_LIMIT, AUTH_WINDOW_SECONDS)];
    if (rule.byEmail && Number(request.headers.get("content-length") ?? 0) <= MAX_BODY_BYTES) {
      const email = extractEmail(await request.clone().json().catch(() => null));
      if (email) checks.push(hitRateLimit(db, await emailKey(rule, email), AUTH_EMAIL_LIMIT, AUTH_WINDOW_SECONDS));
    }

    const results = await Promise.all(checks);
    if (Math.random() < PRUNE_PROBABILITY) await inBackground(pruneRateLimits(db), "prune-rate-limits");
    if (results.every((r) => r.allowed)) return null;
  } catch (error) {
    console.error("auth rate limiter unavailable, failing open", error instanceof Error ? error.message : "unknown");
    return null;
  }

  return Response.json(
    { message: "Too many requests", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(AUTH_WINDOW_SECONDS) } },
  );
}
