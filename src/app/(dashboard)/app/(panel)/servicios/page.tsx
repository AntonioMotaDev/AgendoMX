import { EmptyState } from "@/components/ui/empty-state";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ServiceList } from "@/components/dashboard/service-list";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";
import { listServices } from "@/server/queries/services";

export const metadata: Metadata = { title: "Servicios — AgendoMX", robots: { index: false } };

const t = copy.panel.services;

export default async function ServicesPage() {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  const items = await listServices(await getDb(), business.id);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-base text-ink-muted">{t.subtitle}</p>
        </div>
        <Link
          href="/app/servicios/nuevo"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-ink px-4 text-sm font-semibold text-surface hover:bg-ink/90"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t.add}
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState kind="emptyServices" title={t.emptyTitle} hint={t.emptyHint} />
      ) : (
        <ServiceList
          items={items.map((s) => ({
            id: s.id,
            name: s.name,
            priceCents: s.priceCents,
            priceIsFrom: s.priceIsFrom,
            durationMin: s.durationMin,
            isActive: s.isActive,
            isBookableOnline: s.isBookableOnline,
          }))}
        />
      )}
    </section>
  );
}
