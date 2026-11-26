"use client";

import { useState } from "react";
import { copy } from "@/lib/copy";
import type { AgendaCardData } from "@/server/services/agenda-view";
import { AppointmentCard } from "./appointment-card";

const t = copy.panel.agenda;

/**
 * Requests waiting for an answer. On phones only the first one shows, so the day's
 * agenda stays within reach; the rest open with "Ver N más". Larger screens show all.
 */
export function PendingRequests({ cards }: { cards: AgendaCardData[] }) {
  const [all, setAll] = useState(false);
  return (
    <section aria-labelledby="pending-title" className="rounded-[20px] border border-brand/30 bg-brand/10 p-3.5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="pending-title" className="whitespace-nowrap text-[17px] font-extrabold text-ink">
          {t.pendingTitle} · {cards.length}
        </h2>
        <p className="text-[13px] text-ink-muted">{t.pendingHint}</p>
      </div>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {cards.map((c, i) => (
          <AppointmentCard key={c.id} card={c} variant="request" className={!all && i > 0 ? "max-sm:hidden" : undefined} />
        ))}
      </ul>
      {cards.length > 1 ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll(!all)}
          className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold text-ink hover:bg-paper sm:hidden"
        >
          {all ? t.showLess : t.showMore(cards.length - 1)}
        </button>
      ) : null}
    </section>
  );
}
