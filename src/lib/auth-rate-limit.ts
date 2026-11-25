export const AUTH_WINDOW_SECONDS = 60;
export const AUTH_IP_LIMIT = 20;
export const AUTH_EMAIL_LIMIT = 5;

export type AuthLimitRule = { endpoint: string; byEmail: boolean };

/**
 * Auth endpoints that accept credentials or trigger an email. Per-email limits
 * stop one victim's inbox from being flooded and slow credential stuffing from
 * many IPs; per-IP limits slow everything else.
 */
const RULES: Record<string, AuthLimitRule> = {
  "/api/auth/sign-in/email": { endpoint: "sign-in", byEmail: true },
  "/api/auth/sign-up/email": { endpoint: "sign-up", byEmail: true },
  "/api/auth/request-password-reset": { endpoint: "request-reset", byEmail: true },
  "/api/auth/send-verification-email": { endpoint: "send-verification", byEmail: true },
  "/api/auth/reset-password": { endpoint: "reset-password", byEmail: false },
};

export function matchAuthRule(method: string, pathname: string): AuthLimitRule | null {
  if (method !== "POST") return null;
  return RULES[pathname.replace(/\/$/, "")] ?? null;
}

/** Lowercased, trimmed email from a JSON body, or null if absent/invalid. */
export function extractEmail(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("email" in body)) return null;
  const email = (body as { email: unknown }).email;
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && normalized.length <= 254 ? normalized : null;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ipKey(rule: AuthLimitRule, ip: string): Promise<string> {
  // Hashed like emails: IPs are personal data and have no business in plain text.
  return `ip:${rule.endpoint}:${await sha256Hex(ip)}`;
}

export async function emailKey(rule: AuthLimitRule, email: string): Promise<string> {
  // Hashed so no address ever sits in a limiter key.
  return `email:${rule.endpoint}:${await sha256Hex(email)}`;
}
