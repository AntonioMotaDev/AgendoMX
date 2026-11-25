import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ManualAppointmentForm } from "@/components/dashboard/manual-appointment-form";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";
import { toLocalDate } from "@/lib/time";
import { listActiveServices } from "@/server/queries/services";

export const metadata: Metadata = { title: "Nueva cita — AgendoMX", robots: { index: false } };

const t = copy.panel.agenda.manual;

export default async function NewAppointmentPage() {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  const services = await listActiveServices(await getDb(), business.id);

  return (
    <section className="flex flex-col gap-5">
      <Link href="/app" className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t.back}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-base text-ink-muted">{t.subtitle}</p>
      </div>
      {services.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-muted">{t.noServices}</p>
      ) : (
        <ManualAppointmentForm
          services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents }))}
          today={toLocalDate(new Date(), business.timezone)}
        />
      )}
    </section>
  );
}
