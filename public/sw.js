/* AgendoMX service worker. Deliberately small:
 *  - Pages are NEVER cached: the panel shows private appointment data, so HTML always comes from the network.
 *  - When a navigation fails (no connection) the visitor sees the precached /offline page instead of the browser error.
 *  - Hashed build assets (/_next/static/*) are cache-first: their URL changes whenever their content does.
 * Bump VERSION to drop old caches. */
const VERSION = "v1";
const SHELL_CACHE = `agendomx-shell-${VERSION}`;
const STATIC_CACHE = `agendomx-static-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("agendomx-") && key !== SHELL_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL).then((response) => response || Response.error())));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
  }
  // Everything else (API, server actions, media, auth) goes straight to the network.
});
