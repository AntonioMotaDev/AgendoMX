"use client";

import { encodeToFit } from "./image-encode";
import { fitWithin, IMAGE_TARGETS, squareCrop, type ImageKind } from "./images";

/** Photos straight from a phone camera are 3–10 MB; anything beyond this is not a photo we want to decode in a browser tab. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export type CompressError = "not_image" | "source_too_large" | "cannot_read" | "cannot_compress";
export type CompressResult = { ok: true; blob: Blob; width: number; height: number } | { ok: false; error: CompressError };

async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    // Honors EXIF rotation, so portrait phone photos are not saved sideways.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
}

/**
 * Resizes and re-encodes a chosen photo in the browser before upload:
 * logo → centered 512 px square, cover → fits 1600×900. Re-encoding through a
 * canvas also drops all metadata (GPS position, camera, dates) from the original.
 */
export async function compressImage(file: File, kind: ImageKind): Promise<CompressResult> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return { ok: false, error: "not_image" };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, error: "source_too_large" };

  const bitmap = await decode(file);
  if (!bitmap) return { ok: false, error: "cannot_read" };

  try {
    const target = IMAGE_TARGETS[kind];
    let source = { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height };
    let out: { width: number; height: number };

    if (target.square) {
      const crop = squareCrop(bitmap.width, bitmap.height);
      source = { sx: crop.sx, sy: crop.sy, sw: crop.size, sh: crop.size };
      const size = Math.min(target.maxWidth, crop.size);
      out = { width: size, height: size };
    } else {
      out = fitWithin(bitmap.width, bitmap.height, target.maxWidth, target.maxHeight);
    }

    const canvas = document.createElement("canvas");
    canvas.width = out.width;
    canvas.height = out.height;
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, error: "cannot_compress" };
    context.imageSmoothingQuality = "high";

    const blob = await encodeToFit(
      (type, quality, flattenAlpha) =>
        new Promise((resolve) => {
          context.clearRect(0, 0, out.width, out.height);
          if (flattenAlpha) {
            // JPEG has no transparency: without this, transparent logos turn black.
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, out.width, out.height);
          }
          context.drawImage(bitmap, source.sx, source.sy, source.sw, source.sh, 0, 0, out.width, out.height);
          canvas.toBlob(resolve, type, quality);
        }),
    );
    return blob ? { ok: true, blob, width: out.width, height: out.height } : { ok: false, error: "cannot_compress" };
  } finally {
    bitmap.close();
  }
}
