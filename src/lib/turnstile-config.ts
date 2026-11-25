import "server-only";
import { optionalEnv } from "@/lib/env";
import type { TurnstileConfig } from "@/lib/turnstile";

/**
 * Read at request time (not inlined at build): the site key is a runtime var
 * per environment. Production-like runtimes without keys fail closed.
 */
export function turnstileConfig(): TurnstileConfig {
  return {
    siteKey: optionalEnv("TURNSTILE_SITE_KEY"),
    secretKey: optionalEnv("TURNSTILE_SECRET_KEY"),
    production: process.env.NODE_ENV === "production",
  };
}
