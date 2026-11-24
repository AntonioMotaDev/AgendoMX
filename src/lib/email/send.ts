import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { optionalEnv } from "@/lib/env";

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
  /** Plain-text fallback. Keeps deliverability up and works in text-only clients. */
  text: string;
}

/**
 * Sends one transactional email through Resend.
 * Without RESEND_API_KEY (local dev) the message is logged instead of sent.
 * Throws on provider errors so callers decide whether to surface or swallow.
 */
export async function sendEmail({ to, subject, react, text }: SendEmailInput): Promise<void> {
  const apiKey = optionalEnv("RESEND_API_KEY");
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not configured");
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const from = optionalEnv("EMAIL_FROM") ?? "AgendoMX <citas@agendomx.com>";
  const html = await render(react);
  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, html, text });
  if (error) throw new Error(`Resend error: ${error.name}`);
}

/**
 * Runs work after the response is sent (Workers `waitUntil`), so auth endpoints
 * answer in constant time whether or not an email is sent (no account probing).
 * Failures are logged without the recipient or link.
 */
export async function inBackground(task: Promise<unknown>, label: string): Promise<void> {
  const guarded = task.catch((error: unknown) => {
    console.error(`background task failed: ${label}`, error instanceof Error ? error.message : "unknown error");
  });
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(guarded);
  } catch {
    // No Workers context (unit tests, plain Node): let it run unawaited.
    void guarded;
  }
}
