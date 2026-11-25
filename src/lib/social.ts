/**
 * Social profile links. Owners can paste a handle ("@barberia_juan") or a URL;
 * we store a normalized https URL on the platform's own domain, so a public
 * profile can never link anywhere else (no javascript:, no look-alike hosts).
 */
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "twitter", "linkedin"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const HOSTS: Record<SocialPlatform, readonly string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  twitter: ["x.com", "twitter.com"],
  linkedin: ["linkedin.com"],
};

/** Handle → profile URL. LinkedIn is ambiguous (person vs company), so it needs a URL. */
const HANDLE_URL: Partial<Record<SocialPlatform, (handle: string) => string>> = {
  instagram: (h) => `https://www.instagram.com/${h}`,
  facebook: (h) => `https://www.facebook.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
  twitter: (h) => `https://x.com/${h}`,
};

const HANDLE_RE = /^[A-Za-z0-9._-]{1,50}$/;
const MAX_URL_LENGTH = 200;

export type SocialResult = { ok: true; url: string | null } | { ok: false };

function hostMatches(host: string, platform: SocialPlatform): boolean {
  const bare = host.toLowerCase().replace(/^(www|m|mobile)\./, "");
  return HOSTS[platform].some((allowed) => bare === allowed || bare.endsWith(`.${allowed}`));
}

/** Empty input clears the field (`url: null`). Anything unrecognized is `{ ok: false }`. */
export function normalizeSocial(platform: SocialPlatform, input: string): SocialResult {
  const value = input.trim();
  if (value === "") return { ok: true, url: null };
  if (value.length > MAX_URL_LENGTH) return { ok: false };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme || value.includes("/")) {
    const candidate = hasScheme ? value : `https://${value}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return { ok: false };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false };
    if (!hostMatches(parsed.hostname, platform)) return { ok: false };
    if (parsed.username || parsed.password || parsed.port) return { ok: false };
    const path = parsed.pathname.replace(/\/+$/, "");
    if (path === "") return { ok: false };
    // Query strings and fragments carry tracking ids; drop them.
    return { ok: true, url: `https://${parsed.hostname.toLowerCase()}${path}` };
  }

  const handle = value.replace(/^@/, "");
  const build = HANDLE_URL[platform];
  if (!build || !HANDLE_RE.test(handle)) return { ok: false };
  return { ok: true, url: build(handle) };
}
