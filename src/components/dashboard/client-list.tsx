"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";
import { eraseClientAction } from "@/server/actions/clients";

const t = copy.panel.clients;

export interface ClientItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  appointments: number;
  lastLabel: string | null;
  upcoming: number;
}

const btn = "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold disabled:opacity-60";

function ClientCard({ client }: { client: ClientItem }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function erase() {
    setBusy(true);
    setError(null);
    const result = await eraseClientAction({ id: client.id });
    if (result.ok) {
      router.refresh();
      return;
    }
    setBusy(false);
    setAsking(false);
    setError(result.error.message);
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-ink">{client.name}</p>
        <p className="text-sm text-ink">{client.phone}</p>
        {client.email ? <p className="truncate text-sm text-ink-muted">{client.email}</p> : null}
        <p className="mt-1 text-sm text-ink-muted">
          {t.appointments(client.appointments)} · {client.lastLabel ? t.last(client.lastLabel) : t.noAppointments}
        </p>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {asking ? (
        <div className="flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/5 p-3">
          <p className="text-sm font-semibold text-ink">{t.eraseTitle(client.name)}</p>
          <p className="text-sm text-ink">{t.eraseBody}</p>
          <div className="flex gap-2">
            <button type="button" className={`${btn} border border-line bg-surface text-ink hover:bg-paper`} disabled={busy} onClick={() => setAsking(false)}>
              {t.eraseNo}
            </button>
            <button type="button" className={`${btn} bg-danger text-surface hover:bg-danger/90`} disabled={busy} onClick={erase}>
              {busy ? t.erasing : t.eraseYes}
            </button>
          </div>
        </div>
      ) : client.upcoming > 0 ? (
        <p className="text-sm text-ink-muted">{t.eraseBlocked(client.upcoming)}</p>
      ) : (
        <button type="button" className={`${btn} self-start text-danger hover:bg-danger/5`} onClick={() => setAsking(true)}>
          {t.erase}
        </button>
      )}
    </li>
  );
}

export function ClientList({ items }: { items: ClientItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((client) => (
        <ClientCard key={client.id} client={client} />
      ))}
    </ul>
  );
}
