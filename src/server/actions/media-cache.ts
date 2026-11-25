import { appUrl } from "@/lib/env";
import { keyFromMediaUrl, mediaUrl } from "@/lib/images";

/**
 * Drops replaced/removed images from the Workers edge cache in this location,
 * so the owner sees the old photo disappear right away. Other locations hold
 * their copy for at most the route's max-age. Best effort; never throws.
 */
export async function purgeCachedImages(urls: Array<string | null>): Promise<void> {
  const edge = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : undefined;
  if (!edge) return; // plain Node (next dev) has no edge cache
  for (const url of urls) {
    const key = keyFromMediaUrl(url);
    if (!key) continue;
    try {
      await edge.delete(new Request(`${appUrl()}${mediaUrl(key)}`));
    } catch (error) {
      console.error("could not purge cached image", error instanceof Error ? error.message : "unknown error");
    }
  }
}
