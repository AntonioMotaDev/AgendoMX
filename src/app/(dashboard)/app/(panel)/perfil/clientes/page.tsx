import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";
import { ClientList } from "@/components/dashboard/client-list";
import { ProfileSubpage } from "@/components/dashboard/profile-subpage";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { formatInstantDate } from "@/lib/dates";
import { getCurrentBusiness } from "@/lib/session";
import { listClients } from "@/server/queries/clients";

export const metadata: Metadata = { title: "Tus clientes — AgendoMX", robots: { index: false } };

const t = copy.panel.clients;

export default async function ClientsPage() {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  const rows = await listClients(await getDb(), business.id, new Date());

  return (
    <ProfileSubpage title={t.title} subtitle={t.subtitle}>
      {rows.length === 0 ? (
        <EmptyState kind="emptyClients" title={t.empty} hint={t.emptyHint} />
      ) : (
        <>
          <p className="text-sm text-ink-muted">{t.count(rows.length)}</p>
          <ClientList
            items={rows.map((r) => ({
              id: r.id,
              name: r.name,
              phone: r.phone,
              email: r.email,
              appointments: r.appointments,
              lastLabel: r.lastAppointmentAt ? formatInstantDate(r.lastAppointmentAt, business.timezone) : null,
              upcoming: r.upcoming,
            }))}
          />
          <p className="text-sm text-ink-muted">{t.note}</p>
        </>
      )}
    </ProfileSubpage>
  );
}
