import { getCloudflareContext } from "@opennextjs/cloudflare";
import { contentTypeForKey, isImageKey } from "@/lib/images";

/**
 * Public delivery of business logos and covers from R2. Only keys that match
 * our own naming scheme are served, so this can never expose anything else in
 * the bucket. Each upload has its own random key, so responses are safe to cache.
 */
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=86400";

export async function GET(request: Request, { params }: RouteContext<"/media/[...key]">) {
  const { key: parts } = await params;
  const key = parts.join("/");
  const contentType = contentTypeForKey(key);
  if (!isImageKey(key) || !contentType) return new Response("Not found", { status: 404 });

  const { env, ctx } = await getCloudflareContext({ async: true });

  // Edge cache (Workers only; plain Node in `next dev` has no `caches`).
  const edge = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : undefined;
  const cached = await edge?.match(request);
  if (cached) return cached;

  const object = await env.ASSETS_BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": CACHE_CONTROL,
    ETag: object.httpEtag,
    // Never let a browser reinterpret the bytes, and never run anything from this origin path.
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });

  if (request.headers.get("if-none-match") === object.httpEtag) return new Response(null, { status: 304, headers });

  const response = new Response(object.body, { headers });
  if (edge) ctx.waitUntil(edge.put(request, response.clone()));
  return response;
}
