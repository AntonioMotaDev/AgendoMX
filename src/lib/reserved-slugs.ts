/**
 * Slugs a business cannot take because they collide with app routes,
 * static files or names we may need later. Keep sorted.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "_next",
  "about",
  "acerca",
  "admin",
  "agendomx",
  "api",
  "app",
  "assets",
  "ayuda",
  "blog",
  "cita",
  "citas",
  "contacto",
  "dashboard",
  "explorar",
  "favicon.ico",
  "forma01",
  "help",
  "icons",
  "login",
  "logout",
  "manifest.webmanifest",
  "precios",
  "privacidad",
  "recuperar",
  "registro",
  "robots.txt",
  "settings",
  "signin",
  "signup",
  "sitemap.xml",
  "soporte",
  "staging",
  "static",
  "status",
  "media",
  "offline",
  "sw.js",
  "terminos",
  "www",
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export type SlugCheck = { ok: true } | { ok: false; reason: "format" | "reserved" | "double_hyphen" };

export function checkSlug(slug: string): SlugCheck {
  if (!SLUG_RE.test(slug)) return { ok: false, reason: "format" };
  if (slug.includes("--")) return { ok: false, reason: "double_hyphen" };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: "reserved" };
  return { ok: true };
}

/** "Barbería Don Juan" → "barberia-don-juan" (not guaranteed to pass checkSlug). */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
