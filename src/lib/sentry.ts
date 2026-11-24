import { captureConsoleIntegration, type CloudflareOptions } from "@sentry/cloudflare";

/** Query strings carry one-time tokens (verify email, reset password): never ship them. */
export function stripQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

type ScrubbableEvent = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: Record<string, string>; data?: unknown };
  user?: { ip_address?: string | null; email?: string; username?: string } | undefined;
};

/**
 * Removes everything that can identify a person or grant access from an event:
 * cookies, auth headers, request bodies, query strings and the user's IP/email.
 * AgendoMX stores customers' phone numbers and names, so nothing from a request
 * body should reach a third party (CLAUDE.md §6).
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    const { request } = event;
    if (request.url) request.url = stripQuery(request.url);
    delete request.query_string;
    delete request.cookies;
    delete request.data;
    if (request.headers) {
      for (const name of Object.keys(request.headers)) {
        if (/^(cookie|authorization|x-forwarded-for|cf-connecting-ip)$/i.test(name)) delete request.headers[name];
      }
    }
  }
  if (event.user) event.user = undefined;
  return event;
}

interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
}

/** Options for `withSentry`. Without a DSN the SDK stays disabled. */
export function sentryOptions(env: SentryEnv): CloudflareOptions {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? "production",
    // Errors only for now; Workers Logs already covers request logs.
    tracesSampleRate: 0,
    // Next reports render/route errors with console.error and OpenNext cannot load
    // an instrumentation hook (onRequestError), so forward console errors instead.
    integrations: [captureConsoleIntegration({ levels: ["error"] })],
    beforeSend: (event) => scrubEvent(event),
  };
}
