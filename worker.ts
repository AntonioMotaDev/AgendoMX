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
import { sentryOptions } from "./src/lib/sentry";

export default Sentry.withSentry(
  (env: CloudflareEnv) => sentryOptions(env as unknown as { SENTRY_DSN?: string; SENTRY_ENVIRONMENT?: string }),
  openNext as ExportedHandler<CloudflareEnv>,
);
