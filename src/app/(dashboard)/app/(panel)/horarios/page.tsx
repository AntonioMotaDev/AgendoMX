import type { Metadata } from "next";
import { ExceptionsPanel } from "@/components/dashboard/exceptions-panel";
import { WeeklyScheduleForm } from "@/components/dashboard/weekly-schedule-form";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";
import { toLocalDate } from "@/lib/time";
import { getPrimaryStaff, getScheduleRules } from "@/server/queries/business";
import { listUpcomingExceptions } from "@/server/queries/schedule";
import { rulesToSchedule } from "@/server/services/schedule";

export const metadata: Metadata = { title: "Horarios — AgendoMX", robots: { index: false } };

const t = copy.panel.schedule;

export default async function SchedulePage() {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  const db = await getDb();
  const staff = await getPrimaryStaff(db, business.id);
  const rules = staff ? await getScheduleRules(db, staff.id) : [];
  const today = toLocalDate(new Date(), business.timezone);
  const exceptions = await listUpcomingExceptions(db, business.id, today);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-base text-ink-muted">{t.subtitle}</p>
      </div>

      <section aria-labelledby="weekly-title" className="flex flex-col gap-4">
        <h2 id="weekly-title" className="text-lg font-semibold">
          {t.weeklyTitle}
        </h2>
        <WeeklyScheduleForm initial={rulesToSchedule(rules)} />
      </section>

      <section aria-labelledby="exceptions-title" className="flex flex-col gap-4">
        <div>
          <h2 id="exceptions-title" className="text-lg font-semibold">
            {t.exceptionsTitle}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t.exceptionsHint}</p>
        </div>
        <ExceptionsPanel days={exceptions} today={today} />
      </section>
    </div>
  );
}
