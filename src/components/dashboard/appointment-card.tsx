"use client";

import { Check, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { changeAppointmentStatusAction } from "@/server/actions/appointments";
import type { OwnerAction } from "@/server/services/appointment-status";
import type { AgendaCardData } from "@/server/services/agenda-view";

const t = copy.panel.agenda;

const STATUS_STYLE: Record<AgendaCardData["status"], string> = {
  pending: "bg-brand/15 text-brand-ink",
  confirmed: "bg-success/10 text-success",
  completed: "bg-ink/5 text-ink-muted",
  no_show: "bg-danger/10 text-danger",
  cancelled: "bg-ink/5 text-ink-muted",
  rejected: "bg-ink/5 text-ink-muted",
  expired: "bg-ink/5 text-ink-muted",
};

const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold disabled:opacity-60";
const solid = `${btn} bg-ink text-surface hover:bg-ink/90`;
const outline = `${btn} border border-line bg-surface text-ink hover:bg-paper`;

/** What the card is for: pending requests lead with the answer, the day list with the time. */
export function AppointmentCard({ card, showDate }: { card: AgendaCardData; showDate: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState<"reject" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: OwnerAction) {
    setBusy(true);
    setError(null);
    const result = await changeAppointmentStatusAction({ id: card.id, action });
    if (result.ok) {
      setAsking(null);
      router.refresh(); // the card leaves or changes with the new data
      return;
    }
    setBusy(false);
    setError(result.error.message);
    router.refresh();
  }

  const has = (a: OwnerAction) => card.actions.includes(a);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{showDate ? card.whenLabel : card.timeLabel}</p>
          <p className="mt-0.5 text-base text-ink">{card.clientName}</p>
          <p className="text-sm text-ink-muted">
            {card.serviceName}
            {card.priceLabel ? ` · ${card.priceLabel}` : ""}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[card.status])}>{t.status[card.status as keyof typeof t.status] ?? card.status}</span>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {asking ? (
        <div className="flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/5 p-3">
          <p className="text-sm text-ink">{t.confirmAsk[asking]}</p>
          <div className="flex gap-2">
            <button type="button" className={outline} disabled={busy} onClick={() => setAsking(null)}>
              {t.confirmNo}
            </button>
            <button type="button" className={`${btn} bg-danger text-surface hover:bg-danger/90`} disabled={busy} onClick={() => run(asking)}>
              {busy ? t.working : t.confirmYes}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {has("confirm") ? (
            <button type="button" className={solid} disabled={busy} onClick={() => run("confirm")}>
              <Check aria-hidden="true" className="h-4 w-4" />
              {busy ? t.working : t.actions.confirm}
            </button>
          ) : null}
          {has("complete") ? (
            <button type="button" className={solid} disabled={busy} onClick={() => run("complete")}>
              <Check aria-hidden="true" className="h-4 w-4" />
              {t.actions.complete}
            </button>
          ) : null}
          {has("no_show") ? (
            <button type="button" className={outline} disabled={busy} onClick={() => run("no_show")}>
              {t.actions.no_show}
            </button>
          ) : null}
          {card.whatsappHref ? (
            <a href={card.whatsappHref} target="_blank" rel="noopener noreferrer" className={outline}>
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              {card.whatsappLabel}
            </a>
          ) : null}
          {has("reject") ? (
            <button type="button" className={outline} disabled={busy} onClick={() => setAsking("reject")}>
              <X aria-hidden="true" className="h-4 w-4" />
              {t.actions.reject}
            </button>
          ) : null}
          {has("cancel") && !has("reject") ? (
            <button type="button" className={`${btn} text-danger hover:bg-danger/5`} disabled={busy} onClick={() => setAsking("cancel")}>
              {t.actions.cancel}
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
}
