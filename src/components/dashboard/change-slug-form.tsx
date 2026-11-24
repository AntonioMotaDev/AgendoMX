"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SlugStatus, useSlugStatus } from "@/components/onboarding/slug-status";
import { copy } from "@/lib/copy";
import { changeSlugAction } from "@/server/actions/profile";

const t = copy.panel.profile.link;
const b = copy.onboarding.business;
const common = copy.panel.common;

export function ChangeSlugForm({ currentSlug, publicHost }: { currentSlug: string; publicHost: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [changed, setChanged] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { state, markTaken } = useSlugStatus(slug);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setChanged(null);
    setSaving(true);
    const result = await changeSlugAction({ slug, acknowledge });
    setSaving(false);
    if (!result.ok) {
      if (result.error.message === b.slugTaken) markTaken();
      return setError(result.error);
    }
    setChanged(result.data.slug);
    setSlug("");
    setAcknowledge(false);
    router.refresh();
  }

  const blocked = state.kind === "taken" || state.kind === "invalid" || state.kind === "idle" || !acknowledge;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">{t.changeTitle}</h2>
      <Alert tone="info">{t.changeWarning}</Alert>
      {changed ? (
        <Alert tone="success">
          {t.changed} {publicHost}/{changed}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-slug" className="text-sm font-medium text-ink">
          {t.newSlug}
        </label>
        <div className={`flex min-h-12 items-center rounded-md border bg-surface px-3.5 ${state.kind === "taken" || state.kind === "invalid" ? "border-danger" : "border-stone"}`}>
          <span className="shrink-0 text-base text-ink-muted">{publicHost}/</span>
          <input
            id="new-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={currentSlug}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="new-slug-status"
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink placeholder:text-ink-muted focus-visible:outline-none"
          />
        </div>
        <p id="new-slug-status" role="status" aria-live="polite" className="min-h-5 text-sm">
          <SlugStatus state={state} serverError={error?.field === "slug" ? error.message : undefined} />
        </p>
      </div>

      <label className="flex min-h-11 items-start gap-3 text-base text-ink">
        <input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-ink" />
        <span>{t.acknowledge}</span>
      </label>

      {error && error.field !== "slug" ? <Alert tone="error">{error.message}</Alert> : null}

      <Button type="submit" disabled={saving || blocked}>
        {saving ? common.saving : t.submit}
      </Button>
    </form>
  );
}
