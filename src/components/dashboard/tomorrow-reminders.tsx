import { MessageCircle } from "lucide-react";
import { copy } from "@/lib/copy";
import type { AgendaCardData } from "@/server/services/agenda-view";

const t = copy.panel.agenda;

/** Tomorrow's confirmed appointments with a one-tap WhatsApp reminder (the MVP's main reminder). Cards come from `buildAgendaCard(..., "tomorrow")`. */
export function TomorrowReminders({ cards, dayLabel }: { cards: AgendaCardData[]; dayLabel: string }) {
  return (
    <section aria-labelledby="tomorrow-title" className="rounded-[20px] border border-line bg-surface p-3.5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="tomorrow-title" className="whitespace-nowrap text-[17px] font-extrabold text-ink">
          {t.tomorrowTitle2}
          {cards.length > 0 ? ` · ${t.count(cards.length)}` : ""}
        </h2>
        <p className="text-[13px] text-ink-muted">{dayLabel}</p>
      </div>
      {cards.length === 0 ? (
        <p className="py-2 text-sm text-ink-muted">{t.tomorrowEmpty}</p>
      ) : (
        <ul>
          {cards.map((c, i) => (
            <li key={c.id} className={`flex min-h-[52px] items-center gap-3 ${i > 0 ? "border-t border-line" : ""}`}>
              <span className="w-11 text-sm font-extrabold tabular-nums text-ink">{c.startClock}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{c.clientName}</span>
              {c.whatsappHref ? (
                <a
                  href={c.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.remindTo(c.clientName)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-paper"
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  {t.remindShort}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
