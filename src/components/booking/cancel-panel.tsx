"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/public/notice";
import { tButton } from "@/components/public/styles";
import { copy } from "@/lib/copy";
import { cancelBookingAction } from "@/server/actions/booking";

const t = copy.public.appointment;

/** Two-step cancel (ask, then confirm) so a stray tap never cancels. Rendered inside a ThemeScope. */
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
      <p className="text-sm text-th-muted">{t.canCancelUntil(deadlineLabel)}</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {asking ? (
        <div className="flex flex-col gap-3 rounded-[18px] border border-th-danger/50 bg-th-danger/10 p-4">
          <p className="text-base font-bold text-th-text">{t.confirmCancel}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={tButton.secondary} disabled={busy} onClick={() => setAsking(false)}>
              {t.keep}
            </button>
            <button type="button" className={tButton.danger} disabled={busy} onClick={cancel}>
              {busy ? t.cancelling : t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={tButton.secondary} onClick={() => setAsking(true)}>
          {t.cancel}
        </button>
      )}
    </div>
  );
}
