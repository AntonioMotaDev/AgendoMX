"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";
import { formatMxnShort } from "@/lib/money";
import { moveServiceAction } from "@/server/actions/services";

const t = copy.panel.services;

export interface ServiceListItem {
  id: string;
  name: string;
  priceCents: number | null;
  priceIsFrom: boolean;
  durationMin: number;
  isActive: boolean;
  isBookableOnline: boolean;
}

function priceText(item: ServiceListItem): string {
  if (item.priceCents === null) return t.noPrice;
  return item.priceIsFrom ? `${t.from} ${formatMxnShort(item.priceCents)}` : formatMxnShort(item.priceCents);
}

const iconButton =
  "flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30";

export function ServiceList({ items }: { items: ServiceListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(id: string, direction: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const result = await moveServiceAction(id, direction);
      if (!result.ok) setError(result.error.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center gap-1 rounded-lg border border-line bg-surface pl-4 pr-1">
            <Link href={`/app/servicios/${item.id}`} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center py-2">
              <span className="truncate text-base font-semibold text-ink">{item.name}</span>
              <span className="text-sm text-ink-muted">
                {priceText(item)} · {copy.onboarding.service.durationOption(item.durationMin)}
              </span>
              {!item.isActive || !item.isBookableOnline ? (
                <span className="mt-1 flex gap-1.5">
                  {!item.isActive ? <span className="rounded bg-ink px-1.5 py-0.5 text-xs font-medium text-surface">{t.hidden}</span> : null}
                  {item.isActive && !item.isBookableOnline ? (
                    <span className="rounded border border-stone px-1.5 py-0.5 text-xs font-medium text-ink">{t.inPersonOnly}</span>
                  ) : null}
                </span>
              ) : null}
            </Link>
            <button type="button" aria-label={t.moveUp(item.name)} className={iconButton} disabled={pending || index === 0} onClick={() => move(item.id, "up")}>
              <ArrowUp aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={t.moveDown(item.name)}
              className={iconButton}
              disabled={pending || index === items.length - 1}
              onClick={() => move(item.id, "down")}
            >
              <ArrowDown aria-hidden="true" className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
