import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { hitRateLimit } from "@/db/rate-limit";
import { businesses } from "@/db/schema";
import {
  buildImageKey,
  checkUpload,
  keyFromMediaUrl,
  mediaUrl,
  randomImageId,
  type ImageKind,
  type ImageRejection,
} from "@/lib/images";

/** The slice of an R2 bucket we use, so tests can pass an in-memory fake. */
export interface ImageBucket {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
}

/** Uploads per business per hour. Plenty for a person, a ceiling for a script. */
export const UPLOADS_PER_HOUR = 20;

/** `replacedUrl` is the image that was just superseded, so callers can purge it from caches. */
export type SaveImageResult = { ok: true; data: { url: string; replacedUrl: string | null } } | { ok: false; error: ImageRejection | "rate_limited" | "not_found" };

const column = (kind: ImageKind) => (kind === "logo" ? "logoUrl" : "coverUrl") as "logoUrl" | "coverUrl";

/** Best effort: a leftover object is cheap, a failed request over it is not worth it. */
export async function deleteQuietly(bucket: ImageBucket, key: string | null) {
  if (!key) return;
  try {
    await bucket.delete(key);
  } catch (error) {
    console.error("could not delete image object", error instanceof Error ? error.message : "unknown error");
  }
}

/**
 * Validates, stores and publishes a business image, then removes the one it
 * replaces. Keys are random per upload so caches never serve a stale image.
 */
export async function saveBusinessImage(db: Db, bucket: ImageBucket, businessId: string, kind: ImageKind, bytes: Uint8Array): Promise<SaveImageResult> {
  const checked = checkUpload(bytes);
  if (!checked.ok) return { ok: false, error: checked.reason };

  const limit = await hitRateLimit(db, `upload:${businessId}`, UPLOADS_PER_HOUR, 3600);
  if (!limit.allowed) return { ok: false, error: "rate_limited" };

  const [current] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!current) return { ok: false, error: "not_found" };

  const key = buildImageKey(businessId, kind, checked.image.ext, randomImageId());
  await bucket.put(key, bytes, { httpMetadata: { contentType: checked.image.type } });

  const url = mediaUrl(key);
  try {
    const updated = await db.update(businesses).set({ [column(kind)]: url }).where(eq(businesses.id, businessId)).returning({ id: businesses.id });
    if (updated.length === 0) throw new Error("business vanished");
  } catch (error) {
    await deleteQuietly(bucket, key); // never leave an object nobody points at
    if (error instanceof Error && error.message === "business vanished") return { ok: false, error: "not_found" };
    throw error;
  }

  const replacedUrl = current[column(kind)];
  await deleteQuietly(bucket, keyFromMediaUrl(replacedUrl));
  return { ok: true, data: { url, replacedUrl } };
}

export async function removeBusinessImage(db: Db, bucket: ImageBucket, businessId: string, kind: ImageKind): Promise<{ ok: true; data: { removedUrl: string | null } } | { ok: false; error: "not_found" }> {
  const [current] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!current) return { ok: false, error: "not_found" };

  await db.update(businesses).set({ [column(kind)]: null }).where(eq(businesses.id, businessId));
  const removedUrl = current[column(kind)];
  await deleteQuietly(bucket, keyFromMediaUrl(removedUrl));
  return { ok: true, data: { removedUrl } };
}
