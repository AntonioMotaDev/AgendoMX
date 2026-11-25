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

export interface Coords {
  lat: number;
  lng: number;
}

/** Rough bounding box of Mexico; anything outside is treated as "not a pin we trust". */
const MX_BOUNDS = { latMin: 14, latMax: 33.5, lngMin: -119, lngMax: -86 } as const;

function validCoords(lat: number, lng: number): Coords | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < MX_BOUNDS.latMin || lat > MX_BOUNDS.latMax || lng < MX_BOUNDS.lngMin || lng > MX_BOUNDS.lngMax) return null;
  return { lat, lng };
}

const NUM = "-?\\d{1,3}(?:\\.\\d+)?";
const PAIR_RE = new RegExp(`^\\s*(${NUM})\\s*,\\s*(${NUM})\\s*$`);

function fromPair(value: string | null): Coords | null {
  const m = value ? PAIR_RE.exec(value) : null;
  return m ? validCoords(Number(m[1]), Number(m[2])) : null;
}

/**
 * Best-effort pin from a full (already normalized) map link. Short links
 * (maps.app.goo.gl) carry no coordinates; they are resolved separately.
 * Order matters: `!3d..!4d..` is the place itself, `@lat,lng` is only the viewport.
 */
export function extractCoords(url: string): Coords | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const decodedPath = (() => {
    try {
      return decodeURIComponent(parsed.pathname);
    } catch {
      return parsed.pathname;
    }
  })();

  const place = new RegExp(`!3d(${NUM})!4d(${NUM})`).exec(decodedPath + parsed.search);
  if (place) {
    const c = validCoords(Number(place[1]), Number(place[2]));
    if (c) return c;
  }
  const at = new RegExp(`@(${NUM}),(${NUM})`).exec(decodedPath);
  if (at) {
    const c = validCoords(Number(at[1]), Number(at[2]));
    if (c) return c;
  }
  for (const key of ["q", "ll", "query", "destination", "daddr"]) {
    const c = fromPair(parsed.searchParams.get(key));
    if (c) return c;
  }
  const mlat = parsed.searchParams.get("mlat");
  const mlon = parsed.searchParams.get("mlon");
  if (mlat && mlon) return validCoords(Number(mlat), Number(mlon));
  return null;
}
