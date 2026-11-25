/**
 * Worker entry. Wraps the OpenNext-generated worker with Sentry so unhandled
 * errors reach Sentry. Everything else (routing, Next server) is OpenNext's.
 * wrangler.jsonc -> "main": "worker.ts". `.open-next/worker.js` is produced by
 * `opennextjs-cloudflare build`.
 */
import * as Sentry from "@sentry/cloudflare";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- the file exists only after a build, so expect-error would flip-flop
// @ts-ignore generated at build time, absent before the first `opennextjs-cloudflare build`
import openNext from "./.open-next/worker.js";
import { cronToken } from "./src/lib/cron-auth";
import { sentryOptions } from "./src/lib/sentry";

const handler: ExportedHandler<CloudflareEnv> = {
  fetch: (openNext as ExportedHandler<CloudflareEnv>).fetch,
  /**
   * Cron Trigger (see "triggers" in wrangler.jsonc). The work runs inside the
   * normal Next/OpenNext request path, through the self-reference binding, so it
   * reuses the app's DB client, email code and env handling. Authenticated with a
   * token derived from BETTER_AUTH_SECRET: no extra secret to configure.
   */
  async scheduled(_event, env, ctx) {
    if (!env.WORKER_SELF_REFERENCE) throw new Error("WORKER_SELF_REFERENCE binding is missing");
    const base = env.BETTER_AUTH_URL.replace(/\/$/, "");
    const request = new Request(`${base}/api/cron/tick`, {
      method: "POST",
      headers: { authorization: `Bearer ${await cronToken(env.BETTER_AUTH_SECRET)}` },
    });
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch(request).then(async (response) => {
        // Throwing makes the failure visible to Sentry and in the Workers cron history.
        if (!response.ok) throw new Error(`cron tick answered ${response.status}`);
      }),
    );
  },
};

export default Sentry.withSentry((env: CloudflareEnv) => sentryOptions(env as unknown as { SENTRY_DSN?: string; SENTRY_ENVIRONMENT?: string }), handler);
