"use client";

import { Check, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { changeAppointmentStatusAction } from "@/server/actions/appointments";
import type { AgendaCardData } from "@/server/services/agenda-view";
import type { OwnerAction } from "@/server/services/appointment-status";
import { StatusPill } from "./status-pill";

const t = copy.panel.agenda;

const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-60";
const solid = `${btn} bg-ink text-surface hover:bg-ink/90`;
const outline = `${btn} border border-line bg-surface text-ink hover:bg-paper`;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

interface Props {
  card: AgendaCardData;
  /** "row": an entry of the agenda's time line. "request": a pending request that needs an answer. */
  variant?: "row" | "request";
  /** Row only: whether the action buttons start visible. Tapping the card toggles them. */
  defaultOpen?: boolean;
  /** Row only: this is the next appointment to attend. */
  isNext?: boolean;
  /** Row only: the line above / below the dot is hidden at the ends of the list. */
  first?: boolean;
  last?: boolean;
  /** Row only: show the day too ("Jue 3 de dic, 10:00") instead of the clock range. */
  showDate?: boolean;
  /** Row only: how long until it starts, shown on the next appointment ("en 18 min"). */
  untilLabel?: string | null;
  className?: string;
}

/** An appointment of the agenda with the actions the owner may take. Statuses and buttons come from the server (`card.actions`). */
export function AppointmentCard({ card, variant = "row", defaultOpen = false, isNext = false, first = false, last = false, showDate = false, untilLabel = null, className }: Props) {
  const router = useRouter();
  const [asking, setAsking] = useState<"reject" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);

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
  const isRequest = variant === "request";

  const details = (
    <div className="min-w-0">
      {isNext && untilLabel ? <span className="mb-0.5 block text-xs font-bold text-brand-ink">{t.nextLabel(untilLabel)}</span> : null}
      <p className="text-base font-bold tracking-tight text-ink">{card.clientName}</p>
      <p className="text-sm text-ink-muted">
        {isRequest ? `${card.serviceName} · ${card.whenLabel}` : card.serviceName}
        {!isRequest && card.priceLabel ? ` · ${card.priceLabel}` : ""}
      </p>
    </div>
  );

  const controls = (
    <>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {asking ? (
        <div className="flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger/5 p-3">
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
        <div className={cn("flex flex-wrap gap-2", isRequest && "grid grid-cols-2")}>
          {has("reject") ? (
            <button type="button" className={outline} disabled={busy} onClick={() => setAsking("reject")}>
              <X aria-hidden="true" className="h-4 w-4" />
              {t.actions.reject}
            </button>
          ) : null}
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
            <a href={card.whatsappHref} target="_blank" rel="noopener noreferrer" className={cn(outline, isRequest && "col-span-2")}>
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              {card.whatsappLabel}
            </a>
          ) : null}
          {has("cancel") && !has("reject") ? (
            <button type="button" className={`${btn} text-danger hover:bg-danger/5`} disabled={busy} onClick={() => setAsking("cancel")}>
              {t.actions.cancel}
            </button>
          ) : null}
        </div>
      )}
    </>
  );

  if (isRequest) {
    return (
      <li className={cn("flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5", className)}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-extrabold text-brand-ink">
            {initials(card.clientName)}
          </span>
          {details}
        </div>
        {controls}
      </li>
    );
  }

  const hasControls = card.actions.length > 0 || card.whatsappHref !== null;
  const closed = card.status === "completed" || card.status === "no_show";
  const head = (
    <>
      <div className="min-w-0">
        {showDate ? <p className="text-sm font-bold text-ink">{card.whenLabel}</p> : null}
        {details}
      </div>
      <StatusPill status={card.status} />
    </>
  );
  return (
    <li className={cn("grid grid-cols-[50px_14px_minmax(0,1fr)] gap-x-2.5", className)}>
      <div className={cn("pt-[15px] text-right tabular-nums", closed && "opacity-60")}>
        {showDate ? null : (
          <>
            <b className="block text-[15px] font-extrabold leading-tight text-ink">{card.startClock}</b>
            <span className="text-xs text-ink-muted">{card.endClock}</span>
          </>
        )}
      </div>
      <div aria-hidden="true" className="relative">
        <span className={cn("absolute left-1.5 w-0.5 bg-line", first ? "top-5" : "top-0", last ? "bottom-[calc(100%-1.25rem)]" : "bottom-0")} />
        <span
          className={cn(
            "absolute left-px top-4 h-3 w-3 rounded-full border-[3px] bg-paper",
            isNext ? "border-brand bg-brand" : card.status === "confirmed" || card.status === "pending" ? "border-success" : card.status === "no_show" ? "border-danger" : "border-line bg-line",
          )}
        />
      </div>
      <div className={cn("my-1.5 flex flex-col gap-3 rounded-2xl border p-3.5", isNext ? "border-brand/50 bg-brand/10" : closed ? "border-line bg-transparent" : "border-line bg-surface")}>
        {hasControls ? (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 text-left">
            {head}
          </button>
        ) : (
          <div className="flex items-start justify-between gap-3">{head}</div>
        )}
        {open && hasControls ? controls : null}
      </div>
    </li>
  );
}
