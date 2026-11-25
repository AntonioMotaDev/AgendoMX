"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-compress";
import { copy } from "@/lib/copy";
import type { ImageKind } from "@/lib/images";
import { removeBusinessImageAction, uploadBusinessImageAction } from "@/server/actions/media";
import { BusinessAvatar } from "./business-avatar";

const t = copy.panel.profile.images;

type Status = "idle" | "processing" | "uploading" | "removing";

/** Picks a photo, shrinks it in the browser, uploads it, and shows the result right away. */
export function ImageUploader({ kind, currentUrl, businessName }: { kind: ImageKind; currentUrl: string | null; businessName: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Local preview of what was just uploaded, until the refreshed page brings the real URL.
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const shown = preview ?? currentUrl;
  const busy = status !== "idle";
  const title = kind === "logo" ? t.logo : t.cover;
  const hint = kind === "logo" ? t.logoHint : t.coverHint;

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same photo be picked again
    if (!file) return;
    setError(null);
    setMessage(null);

    setStatus("processing");
    const compressed = await compressImage(file, kind);
    if (!compressed.ok) {
      setStatus("idle");
      return setError(t.errors[compressed.error]);
    }

    setStatus("uploading");
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", new File([compressed.blob], `${kind}.${compressed.blob.type === "image/webp" ? "webp" : "jpg"}`, { type: compressed.blob.type }));
    const result = await uploadBusinessImageAction(form);
    setStatus("idle");
    if (!result.ok) return setError(result.error.message);

    setPreview(URL.createObjectURL(compressed.blob));
    setMessage(t.saved);
    router.refresh();
  }

  async function onRemove() {
    setError(null);
    setMessage(null);
    setStatus("removing");
    const result = await removeBusinessImageAction(kind);
    setStatus("idle");
    if (!result.ok) return setError(result.error.message);
    setPreview(null);
    setMessage(t.removed);
    router.refresh();
  }

  return (
    <section aria-labelledby={`${kind}-title`} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div>
        <h2 id={`${kind}-title`} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink-muted">{hint}</p>
      </div>

      {kind === "logo" ? (
        <BusinessAvatar name={businessName} logoUrl={shown} className="h-24 w-24 text-3xl" />
      ) : shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own /media route, already compressed
        <img src={shown} alt={t.altCover(businessName)} className="aspect-video w-full rounded-md border border-line object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-stone bg-paper text-sm text-ink-muted">{t.empty}</div>
      )}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      <p role="status" aria-live="polite" className="text-sm text-ink-muted">
        {status === "processing" ? t.processing : status === "uploading" ? t.uploading : status === "removing" ? t.removing : ""}
      </p>

      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={`${t.choose}: ${title}`} data-testid={`${kind}-file`} onChange={onPick} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
          <Camera aria-hidden="true" className="h-5 w-5" />
          {shown ? t.replace : t.choose}
        </Button>
        {currentUrl ? (
          <Button variant="ghost" className="text-danger" onClick={onRemove} disabled={busy}>
            <Trash2 aria-hidden="true" className="h-5 w-5" />
            {t.remove}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
