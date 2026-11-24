import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { emailKey, extractEmail, ipKey, matchAuthRule } from "@/lib/auth-rate-limit";

const MAX_BODY_BYTES = 8 * 1024;

/**
 * Applies Workers Rate Limiting to an auth request. Returns a 429 response when
 * a limit is hit, otherwise null. Limits are per Cloudflare location and
 * approximate by design: enough to stop scripts, not a hard quota.
 * If the binding is missing or errors we fail open (and log) so a limiter
 * problem can never lock owners out of their accounts.
 */
export async function limitAuthRequest(request: Request): Promise<Response | null> {
  const rule = matchAuthRule(request.method, new URL(request.url).pathname);
  if (!rule) return null;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

    const checks: Promise<{ success: boolean }>[] = [env.AUTH_IP_RATE_LIMITER.limit({ key: await ipKey(rule, ip) })];

    if (rule.byEmail && Number(request.headers.get("content-length") ?? 0) <= MAX_BODY_BYTES) {
      const email = extractEmail(await request.clone().json().catch(() => null));
      if (email) checks.push(env.AUTH_EMAIL_RATE_LIMITER.limit({ key: await emailKey(rule, email) }));
    }

    const results = await Promise.all(checks);
    // TEMP diagnostics (remove once the limiter is verified in production): no PII.
    console.info("[rl-debug]", rule.endpoint, `checks=${checks.length}`, `ip=${ip === "unknown" ? "unknown" : "set"}`, JSON.stringify(results));
    if (results.every((r) => r.success)) return null;
  } catch (error) {
    console.error("auth rate limiter unavailable, failing open", error instanceof Error ? error.message : "unknown");
    return null;
  }

  return Response.json(
    { message: "Too many requests", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
