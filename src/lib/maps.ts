/**
 * "Cómo llegar" link. Owners paste whatever their maps app gives them; we only
 * keep https links to well-known map services, so a public profile can never
 * point visitors somewhere unexpected.
 */
const MAP_HOSTS = [
  "google.com",
  "maps.google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "maps.apple.com",
  "waze.com",
  "openstreetmap.org",
] as const;

export type MapsResult = { ok: true; url: string | null } | { ok: false };

const MAX_LENGTH = 500;

function hostAllowed(host: string): boolean {
  const bare = host.toLowerCase().replace(/^www\./, "");
  return MAP_HOSTS.some((allowed) => bare === allowed || bare.endsWith(`.${allowed}`));
}

/** Empty input clears the field. Short links keep their query string (it is the place id); credentials and ports are refused. */
export function normalizeMapsUrl(input: string): MapsResult {
  const value = input.trim();
  if (value === "") return { ok: true, url: null };
  if (value.length > MAX_LENGTH) return { ok: false };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false };
  if (parsed.username || parsed.password || parsed.port) return { ok: false };
  if (!hostAllowed(parsed.hostname)) return { ok: false };
  // A bare host ("google.com") is not a place.
  if (parsed.pathname.replace(/\/+$/, "") === "" && parsed.search === "") return { ok: false };
  // google.com itself is only a map under /maps; /search and /url?q=... redirectors are not.
  // (maps.google.com is a map service in full, so it is exempt.)
  if (parsed.hostname.toLowerCase().replace(/^www\./, "") === "google.com" && !parsed.pathname.startsWith("/maps")) return { ok: false };
  parsed.protocol = "https:";
  parsed.hash = "";
  return { ok: true, url: parsed.toString() };
}
