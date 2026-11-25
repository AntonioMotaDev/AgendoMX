import { MAX_UPLOAD_BYTES } from "./images";

export type EncodeAttempt = (type: "image/webp" | "image/jpeg", quality: number, flattenAlpha: boolean) => Promise<Blob | null>;

const WEBP_QUALITIES = [0.85, 0.7, 0.55];
const JPEG_QUALITIES = [0.85, 0.7, 0.55, 0.4];

/**
 * Picks the best encoding that fits the upload limit. WebP first (smaller, keeps
 * transparency); browsers that cannot encode WebP (Safari returns PNG instead)
 * fall back to JPEG on a white background. Pure: the caller supplies `encode`
 * (a canvas in the browser, a fake in tests).
 */
export async function encodeToFit(encode: EncodeAttempt, maxBytes: number = MAX_UPLOAD_BYTES): Promise<Blob | null> {
  for (const quality of WEBP_QUALITIES) {
    const blob = await encode("image/webp", quality, false);
    // A browser without WebP encoding silently hands back another type.
    if (!blob || blob.type !== "image/webp") break;
    if (blob.size <= maxBytes) return blob;
  }
  for (const quality of JPEG_QUALITIES) {
    const blob = await encode("image/jpeg", quality, true);
    if (blob && blob.type === "image/jpeg" && blob.size <= maxBytes) return blob;
  }
  return null;
}
