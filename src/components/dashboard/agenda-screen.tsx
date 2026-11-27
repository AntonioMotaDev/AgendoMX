import { EmptyState } from "@/components/ui/empty-state";
import { Plus } from "lucide-react";
import Link from "next/link";
import { renderSVG } from "uqr";
import { AgendaTabs } from "@/components/dashboard/agenda-tabs";
import { AgendaTimeline, type TimelineRow } from "@/components/dashboard/agenda-timeline";
import { BusinessAvatar } from "@/components/dashboard/business-avatar";
import { PendingRequests } from "@/components/dashboard/pending-requests";
import { ShareMini } from "@/components/dashboard/share-mini";
import { TomorrowReminders } from "@/components/dashboard/tomorrow-reminders";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { formatInstantDate } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { getCurrentBusiness } from "@/lib/session";
import { addDays, localDayBounds, toLocalDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { listAgenda, listPendingRequests } from "@/server/queries/appointments";
import { buildAgendaCard, gapMinutes, nextUpcoming, untilLabel } from "@/server/services/agenda-view";

const t = copy.panel.agenda;

function Stat({ label, value, unit, accent = false }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className="min-w-0 px-3.5 py-3 not-first:border-l not-first:border-line">
      <span className="block whitespace-nowrap text-xs font-semibold text-ink-muted">{label}</span>
      <b className={cn("mt-0.5 block text-2xl font-extrabold leading-tight tracking-tight tabular-nums lg:text-[28px]", accent && "text-pa")}>{value}</b>
      <span className="block truncate text-xs text-ink-muted">{unit}</span>
    </div>
  );
}

/** The owner's agenda for today or tomorrow. Today also leads with requests waiting for an answer. */
export async function AgendaScreen({ day }: { day: "today" | "tomorrow" }) {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  const db = await getDb();
  const now = new Date();
  const today = toLocalDate(now, business.timezone);
  const date = day === "today" ? today : addDays(today, 1);
  const { start, end } = localDayBounds(date, business.timezone);
  const tomorrow = localDayBounds(addDays(today, 1), business.timezone);

  const [items, pending, tomorrowItems] = await Promise.all([
    listAgenda(db, business.id, start, end),
    day === "today" ? listPendingRequests(db, business.id, now) : Promise.resolve([]),
    day === "today" ? listAgenda(db, business.id, tomorrow.start, tomorrow.end) : Promise.resolve([]),
  ]);

  const ctx = { business: { name: business.name, category: business.category, timezone: business.timezone }, now };
  const pendingCards = pending.map((p) => buildAgendaCard(p, "pending", ctx));
  // On today's tab pending requests live in their own section, so they are not listed twice.
  const dayItems = items.filter((i) => day === "tomorrow" || i.status !== "pending");
  const next = day === "today" ? nextUpcoming(dayItems, now) : null;
  const rows: TimelineRow[] = dayItems.map((item, i) => ({
    card: buildAgendaCard(item, day, ctx),
    gapBefore: i > 0 ? gapMinutes(dayItems[i - 1]!, item) : null,
    isNext: next?.id === item.id,
    until: next?.id === item.id ? untilLabel(item.startsAt, now) : null,
  }));
  const reminderCards = tomorrowItems.filter((i) => i.status === "confirmed").map((i) => buildAgendaCard(i, "tomorrow", ctx));

  const publicUrl = `${appUrl()}/${business.slug}`;
  const publicHost = new URL(appUrl()).host;
  // Dark modules on white with a quiet zone: scans reliably on screens and paper.
  const qrSvg = renderSVG(publicUrl, { ecc: "M", border: 2, whiteColor: "#ffffff", blackColor: "#252724" });

  const completed = dayItems.filter((i) => i.status === "completed").length;
  const dateLabel = formatInstantDate(start, business.timezone);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BusinessAvatar name={business.name} logoUrl={business.logoUrl} className="h-11 w-11 text-lg" />
          <div className="min-w-0">
            <p className="truncate text-[13px] text-ink-muted">{dateLabel}</p>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight lg:text-[26px]">{day === "today" ? t.todayTitle : t.tomorrowTitle}</h1>
          </div>
        </div>
        <Link href="/app/citas/nueva" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-pa px-4 text-sm font-semibold text-pa-on hover:bg-pa/90">
          <Plus aria-hidden="true" className="h-[18px] w-[18px]" />
          {t.newAppointment}
        </Link>
      </header>

      {day === "today" ? (
        <div className="grid grid-cols-3 rounded-2xl border border-line bg-surface" role="group" aria-label={t.stats.today}>
          <Stat label={t.stats.today} value={String(dayItems.length)} unit={t.stats.completed(completed)} />
          <Stat label={t.stats.requests} value={String(pending.length)} unit={t.stats.requestsUnit(pending.length)} />
          <Stat label={t.stats.next} value={next ? rows.find((r) => r.isNext)!.card.startClock : "—"} unit={next ? untilLabel(next.startsAt, now) : t.stats.nothingNext} accent />
        </div>
      ) : null}

      <AgendaTabs current={day} />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_350px] lg:grid-rows-[auto_auto_auto_1fr] lg:gap-x-7 lg:gap-y-0">
        {pendingCards.length > 0 ? (
          <div className="sm:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mb-5">
            <PendingRequests cards={pendingCards} />
          </div>
        ) : null}

        <div className="min-w-0 sm:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-span-4 lg:row-start-1">
          {rows.length === 0 ? (
            <EmptyState kind="emptyDay" title={day === "today" ? t.emptyToday : t.emptyTomorrow} hint={day === "today" ? t.emptyTodayHint : t.emptyTomorrowHint} />
          ) : (
            <section aria-label={t.count(rows.length)}>
              <p className="mb-2 text-sm text-ink-muted">{t.count(rows.length)}</p>
              <AgendaTimeline rows={rows} openAll={day === "tomorrow"} />
            </section>
          )}
        </div>

        {day === "today" ? (
          <div className="lg:col-start-2 lg:row-start-2 lg:mb-5">
            <TomorrowReminders cards={reminderCards} dayLabel={formatInstantDate(tomorrow.start, business.timezone)} />
          </div>
        ) : null}

        <div className="lg:col-start-2 lg:row-start-3">
          <ShareMini publicUrl={publicUrl} publicHost={publicHost} slug={business.slug} businessName={business.name} qrSvg={qrSvg} />
        </div>
      </div>
    </section>
  );
}
