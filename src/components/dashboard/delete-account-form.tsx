"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { copy } from "@/lib/copy";
import { deleteAccountAction } from "@/server/actions/account";

const t = copy.panel.profile.account;

export interface DeleteAccountFormProps {
  expected: string;
  summary: { businessName: string | null; clients: number; appointments: number; upcoming: number };
}

export function DeleteAccountForm({ expected, summary }: DeleteAccountFormProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    const result = await deleteAccountAction({ confirm });
    if (result.ok) {
      router.replace("/login?eliminada=1");
      return;
    }
    setBusy(false);
    if (result.error.field === "confirm") setFieldError(result.error.message);
    else setError(result.error.message);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-lg border border-danger/40 bg-danger/5 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-danger">
        <TriangleAlert aria-hidden="true" className="h-5 w-5" />
        {t.dangerTitle}
      </h2>
      <div className="flex flex-col gap-2 text-sm text-ink">
        <p>{t.intro}</p>
        <ul className="list-disc space-y-1 pl-5">
          {t.items(summary).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {summary.upcoming > 0 ? <p className="font-semibold">{t.upcoming(summary.upcoming)}</p> : null}
        <p className="text-ink-muted">{t.backups}</p>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field
        label={t.confirmLabel(expected)}
        name="confirm"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        hint={t.confirmHint}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        error={fieldError}
      />
      <button
        type="submit"
        disabled={busy || confirm.trim() === ""}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-danger px-5 text-base font-semibold text-surface hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? t.submitting : t.submit}
      </button>
    </form>
  );
}
