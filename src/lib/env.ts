import "server-only";

/**
 * Secrets and vars. On Workers, OpenNext copies bindings/secrets into
 * process.env; locally Next loads .env.local. Never log these values.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
