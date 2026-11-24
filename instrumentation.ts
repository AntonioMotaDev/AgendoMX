import * as Sentry from "@sentry/cloudflare";

/**
 * Next catches errors thrown while rendering pages, route handlers and server
 * actions, so they never reach the Worker's top-level handler. This hook
 * forwards them to Sentry. Only the route is attached: no headers, cookies or
 * bodies (see src/lib/sentry.ts).
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  Sentry.captureException(error, {
    tags: { routerKind: context.routerKind, routeType: context.routeType },
    extra: { routePath: context.routePath, method: request.method },
  });
}
