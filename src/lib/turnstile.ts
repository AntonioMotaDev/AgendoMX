/**
 * Cloudflare Turnstile verification for the public booking form.
 *
 * Pure of env access on purpose: callers pass the config, so every branch is
 * unit-testable. Policy:
 *  - production without keys  -> fail closed (bookings unavailable, never open)
 *  - non-production without keys -> bypass (local dev / CI)
 *  - keys present -> the token must verify against Cloudflare
 */
export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileMode = "enforce" | "bypass" | "unavailable";

export interface TurnstileConfig {
  siteKey: string | undefined;
  secretKey: string | undefined;
  production: boolean;
}

export function turnstileMode(config: TurnstileConfig): TurnstileMode {
  if (config.siteKey && config.secretKey) return "enforce";
  return config.production ? "unavailable" : "bypass";
}

export type TurnstileVerdict = { ok: true } | { ok: false; reason: "missing_token" | "rejected" | "unavailable" };

type FetchLike = (input: string, init: { method: "POST"; body: URLSearchParams; signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

interface VerifyInput {
  token: unknown;
  remoteIp?: string | null;
  config: TurnstileConfig;
  fetchImpl?: FetchLike;
}

const MAX_TOKEN_LENGTH = 2048;
const TIMEOUT_MS = 5000;

export async function verifyTurnstile({ token, remoteIp, config, fetchImpl }: VerifyInput): Promise<TurnstileVerdict> {
  const mode = turnstileMode(config);
  if (mode === "bypass") return { ok: true };
  if (mode === "unavailable") return { ok: false, reason: "unavailable" };

  if (typeof token !== "string" || token === "" || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "missing_token" };

  const body = new URLSearchParams({ secret: config.secretKey as string, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const send = fetchImpl ?? ((url, init) => fetch(url, init));
    const response = await send(TURNSTILE_VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const data = (await response.json()) as { success?: unknown } | null;
    return data?.success === true ? { ok: true } : { ok: false, reason: "rejected" };
  } catch {
    // Network failure or timeout: do not let bookings through unchecked.
    return { ok: false, reason: "unavailable" };
  }
}
