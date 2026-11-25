"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cancelBookingAction } from "@/server/actions/booking";

const t = copy.public.appointment;

/** Two-step cancel (ask, then confirm) so a stray tap never cancels. */
export function CancelPanel({ token, deadlineLabel }: { token: string; deadlineLabel: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const result = await cancelBookingAction({ token });
    if (result.ok) {
      router.refresh();
      return;
    }
    setBusy(false);
    setError(result.error.message);
    // The window may have closed while the page was open: refresh to show the contact options.
    if (result.error.field === "too_late") router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{t.canCancelUntil(deadlineLabel)}</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {asking ? (
        <div className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger/5 p-4">
          <p className="text-base font-semibold text-ink">{t.confirmCancel}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" disabled={busy} onClick={() => setAsking(false)}>
              {t.keep}
            </Button>
            <Button disabled={busy} onClick={cancel} className="bg-danger text-surface hover:bg-danger/90">
              {busy ? t.cancelling : t.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAsking(true)}>
          {t.cancel}
        </Button>
      )}
    </div>
  );
}
