import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AgendaTabs } from "@/components/dashboard/agenda-tabs";
import { AppointmentCard } from "@/components/dashboard/appointment-card";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { displayLocalDate } from "@/lib/dates";
import { getCurrentBusiness } from "@/lib/session";
import { addDays, localDayBounds, toLocalDate, weekStart, type LocalDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { listAgenda } from "@/server/queries/appointments";
import { buildAgendaCard, type AgendaCardData } from "@/server/services/agenda-view";

const t = copy.panel.agenda;

const arrow = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-paper";

/** Monday to Sunday of the week that contains `focus`, with every appointment grouped by local day. */
export async function WeekScreen({ focus }: { focus: LocalDate | null }) {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  const now = new Date();
  const today = toLocalDate(now, business.timezone);
  const monday = weekStart(focus ?? today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const from = localDayBounds(monday, business.timezone).start;
  const to = localDayBounds(addDays(monday, 7), business.timezone).start;

  const items = await listAgenda(await getDb(), business.id, from, to);
  const ctx = { business: { name: business.name, category: business.category, timezone: business.timezone }, now };
  const byDay = new Map<LocalDate, AgendaCardData[]>(days.map((d) => [d, []]));
  for (const item of items) byDay.get(toLocalDate(item.startsAt, business.timezone))?.push(buildAgendaCard(item, "week", ctx));

  const isThisWeek = monday === weekStart(today);
  const range = `${displayLocalDate(monday)} – ${displayLocalDate(days[6]!)}`;

  return (
    <section className="flex flex-col gap-5">
      <AgendaTabs current="week" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.weekTitle}</h1>
        <p className="mt-1 text-base text-ink-muted">{range}</p>
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/app/semana?s=${addDays(monday, -7)}`} aria-label={t.prevWeek} className={arrow}>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </Link>
        {isThisWeek ? (
          <span className="flex-1 text-center text-sm font-medium text-ink-muted">{t.thisWeek}</span>
        ) : (
          <Link href="/app/semana" className="flex min-h-11 flex-1 items-center justify-center text-sm font-semibold text-brand-ink underline underline-offset-4">
            {t.thisWeek}
          </Link>
        )}
        <Link href={`/app/semana?s=${addDays(monday, 7)}`} aria-label={t.nextWeek} className={arrow}>
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </Link>
      </div>

      <div className="flex flex-col gap-5">
        {days.map((d) => {
          const cards = byDay.get(d) ?? [];
          return (
            <section key={d} aria-labelledby={`day-${d}`} className="flex flex-col gap-3">
              <h2 id={`day-${d}`} className={cn("flex items-baseline justify-between text-base font-semibold", d === today ? "text-brand-ink" : "text-ink")}>
                <span>{displayLocalDate(d, true)}</span>
                <span className="text-sm font-normal text-ink-muted">{cards.length > 0 ? t.count(cards.length) : t.noAppointments}</span>
              </h2>
              {cards.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {cards.map((c) => (
                    <AppointmentCard key={c.id} card={c} showDate={false} />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}
