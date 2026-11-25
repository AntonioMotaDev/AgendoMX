/**
 * Auth for the internal cron endpoint. The Worker's `scheduled` handler and the
 * route both derive the same token from BETTER_AUTH_SECRET, so no extra secret
 * has to be configured. HMAC is one-way: the token reveals nothing about the key.
 * Web Crypto only, so it runs in Workers, Node and the browser-free test runner.
 */
const CONTEXT = "agendomx-cron-v1";

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function cronToken(secret: string): Promise<string> {
  return hmacHex(secret, CONTEXT);
}

/** Constant-time check of an `Authorization: Bearer <token>` header. */
export async function isValidCronRequest(authorization: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const given = authorization.slice("Bearer ".length);
  const expected = await cronToken(secret);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
