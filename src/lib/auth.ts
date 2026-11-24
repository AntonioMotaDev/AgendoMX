import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { sendAuthEmail } from "@/lib/email/auth-emails";
import { inBackground } from "@/lib/email/send";
import { appUrl, requireEnv } from "@/lib/env";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validators/auth";

/**
 * Better Auth instance, built per request: the DB client comes from the
 * request's Hyperdrive binding and must not live in module scope (CLAUDE.md §2).
 * Auth is for owners only; end clients book without an account.
 */
export async function getAuth() {
  const db = await getDb();
  const baseURL = appUrl();
  return betterAuth({
    baseURL,
    secret: requireEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user: u, url }) => {
        await inBackground(sendAuthEmail("reset", u, url), "reset-password-email");
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user: u, url }) => {
        await inBackground(sendAuthEmail("verify", u, url), "verification-email");
      },
    },
    // Better Auth's own limiter is per-isolate memory, useless on Workers.
    // Limits live in src/lib/rate-limit.ts (Workers Rate Limiting binding).
    rateLimit: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    advanced: {
      // Workers sits behind Cloudflare: its header carries the real client IP.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: baseURL.startsWith("https://"),
    },
    plugins: [nextCookies()],
  });
}

export type Auth = Awaited<ReturnType<typeof getAuth>>;
