import { Plus } from "lucide-react";
import Link from "next/link";
import { AgendaTabs } from "@/components/dashboard/agenda-tabs";
import { AppointmentCard } from "@/components/dashboard/appointment-card";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { displayLocalDate } from "@/lib/dates";
import { getCurrentBusiness } from "@/lib/session";
import { addDays, localDayBounds, toLocalDate } from "@/lib/time";
import { listAgenda, listPendingRequests } from "@/server/queries/appointments";
import { buildAgendaCard } from "@/server/services/agenda-view";

const t = copy.panel.agenda;

/** The owner's agenda for today or tomorrow. Today also leads with requests waiting for an answer. */
export async function AgendaScreen({ day }: { day: "today" | "tomorrow" }) {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  const db = await getDb();
  const now = new Date();
  const today = toLocalDate(now, business.timezone);
  const date = day === "today" ? today : addDays(today, 1);
  const { start, end } = localDayBounds(date, business.timezone);

  const [items, pending] = await Promise.all([
    listAgenda(db, business.id, start, end),
    day === "today" ? listPendingRequests(db, business.id, now) : Promise.resolve([]),
  ]);

  const ctx = { business: { name: business.name, category: business.category, timezone: business.timezone }, now };
  const pendingCards = pending.map((p) => buildAgendaCard(p, "pending", ctx));
  // On today's tab pending requests live in their own section above, so they are not listed twice.
  const dayCards = items.filter((i) => day === "tomorrow" || i.status !== "pending").map((i) => buildAgendaCard(i, day, ctx));

  return (
    <section className="flex flex-col gap-5">
      <AgendaTabs current={day} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{day === "today" ? t.todayTitle : t.tomorrowTitle}</h1>
          <p className="mt-1 text-base text-ink-muted">{displayLocalDate(date, true)}</p>
        </div>
        <Link href="/app/citas/nueva" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-ink px-4 text-sm font-semibold text-surface hover:bg-ink/90">
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t.newAppointment}
        </Link>
      </div>

      {pendingCards.length > 0 ? (
        <section aria-labelledby="pending-title" className="flex flex-col gap-3">
          <div>
            <h2 id="pending-title" className="text-lg font-semibold text-ink">
              {t.pendingTitle} · {pendingCards.length}
            </h2>
            <p className="text-sm text-ink-muted">{t.pendingHint}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {pendingCards.map((c) => (
              <AppointmentCard key={c.id} card={c} showDate />
            ))}
          </ul>
        </section>
      ) : null}

      {dayCards.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <p className="text-base font-semibold text-ink">{day === "today" ? t.emptyToday : t.emptyTomorrow}</p>
          <p className="mt-1 text-sm text-ink-muted">{day === "today" ? t.emptyTodayHint : t.emptyTomorrowHint}</p>
        </div>
      ) : (
        <section aria-label={t.count(dayCards.length)} className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{t.count(dayCards.length)}</p>
          <ul className="flex flex-col gap-3">
            {dayCards.map((c) => (
              <AppointmentCard key={c.id} card={c} showDate={false} />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
