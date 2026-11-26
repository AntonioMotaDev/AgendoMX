"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ThemeMini } from "@/components/public/theme-mini";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";
import { THEME_IDS, type BusinessTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { saveThemeAction } from "@/server/actions/profile";

const t = copy.panel.profile.appearance;

/** Picks the business theme. The choice is applied right away and saved; if saving fails it goes back. */
export function ThemePicker({ initial, slug }: { initial: BusinessTheme; slug: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<BusinessTheme>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const confirmed = useRef<BusinessTheme>(initial);

  async function choose(theme: BusinessTheme) {
    if (theme === selected || saving) return;
    const previous = confirmed.current;
    setSelected(theme);
    setError(null);
    setNotice(null);
    setSaving(true);
    const result = await saveThemeAction({ theme });
    setSaving(false);
    if (result.ok) {
      confirmed.current = theme;
      setNotice(t.saved);
      router.refresh();
    } else {
      setSelected(previous);
      setError(result.error.message);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div role="radiogroup" aria-label={t.groupLabel} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {THEME_IDS.map((id) => {
          const info = t.themes[id];
          const on = id === selected;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(id)}
              className={cn(
                "relative flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-2.5 text-left hover:bg-surface",
                on && "border-transparent ring-2 ring-ink",
              )}
            >
              {on ? (
                <span aria-hidden="true" className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-surface">
                  <Check className="h-4 w-4" />
                </span>
              ) : null}
              <ThemeMini theme={id} />
              <span className="flex flex-col px-1 pb-1">
                <span className="text-base font-extrabold text-ink">{info.name}</span>
                <span className="text-xs text-ink-muted">{info.vibe}</span>
                <span className="mt-1 text-xs font-semibold text-ink">{t.ideal(info.fit)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/${slug}`}
          target="_blank"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-surface hover:bg-ink/90"
        >
          {t.viewProfile}
        </Link>
        <p role="status" className="text-sm text-ink-muted">
          {saving ? t.saving : (notice ?? t.contrastNote)}
        </p>
      </div>
    </div>
  );
}
