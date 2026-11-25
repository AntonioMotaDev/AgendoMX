"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { IMAGE_KINDS, MAX_UPLOAD_BYTES, type ImageKind } from "@/lib/images";
import { getCurrentBusiness, requireOwner } from "@/lib/session";
import { guarded } from "./helpers";
import { removeBusinessImage, saveBusinessImage } from "./media-writes";
import { fail, ok, type ActionResult } from "./result";

const t = copy.panel.profile.images;

const isKind = (value: unknown): value is ImageKind => typeof value === "string" && (IMAGE_KINDS as readonly string[]).includes(value);

async function currentBusinessId(): Promise<string | null> {
  await requireOwner();
  return (await getCurrentBusiness())?.id ?? null;
}

async function getBucket() {
  const { env } = await getCloudflareContext({ async: true });
  return env.ASSETS_BUCKET;
}

/**
 * Receives an already-compressed image from the browser. The server still checks
 * size, real format and dimensions from the bytes themselves: the client is not trusted.
 */
export async function uploadBusinessImageAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const businessId = await currentBusinessId();
  if (!businessId) return fail(copy.onboarding.guard.incomplete);

  const kind = formData.get("kind");
  const file = formData.get("file");
  if (!isKind(kind) || !(file instanceof File)) return fail(copy.panel.common.genericError);
  // Cheap check before reading the body into memory.
  if (file.size > MAX_UPLOAD_BYTES) return fail(t.errors.too_large);

  return guarded("uploadBusinessImage", async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await saveBusinessImage(await getDb(), await getBucket(), businessId, kind, bytes);
    return result.ok ? ok(result.data) : fail(t.errors[result.error]);
  });
}

export async function removeBusinessImageAction(kind: ImageKind): Promise<ActionResult> {
  const businessId = await currentBusinessId();
  if (!businessId) return fail(copy.onboarding.guard.incomplete);
  if (!isKind(kind)) return fail(copy.panel.common.genericError);

  return guarded("removeBusinessImage", async () => {
    const result = await removeBusinessImage(await getDb(), await getBucket(), businessId, kind);
    return result.ok ? ok(undefined) : fail(t.errors.not_found);
  });
}
