"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { copy } from "@/lib/copy";
import { acceptTermsAction } from "@/server/actions/account";

const t = copy.panel.legal.gate;
const r = copy.auth.register;

/**
 * Shown instead of the panel while the owner has not accepted the current version of the legal texts.
 * Refusing is possible: the owner can sign out (header) or delete the account (`refuse` slot).
 */
export function AcceptTermsGate({ version, refuse }: { version: string; refuse: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!checked) {
      setFieldError(t.required);
      return;
    }
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    const result = await acceptTermsAction({ version });
    if (result.ok) {
      router.refresh();
      return;
    }
    setBusy(false);
    setError(result.error.message);
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-base text-ink-muted">{t.body}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <CheckboxField
          name="acceptTerms"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          error={fieldError}
          label={
            <>
              {r.acceptPrefix}
              <Link href="/terminos" target="_blank" className="font-medium text-brand-ink underline underline-offset-2">
                {r.acceptTerms}
              </Link>
              {r.acceptAnd}
              <Link href="/privacidad" target="_blank" className="font-medium text-brand-ink underline underline-offset-2">
                {r.acceptPrivacy}
              </Link>
              .
            </>
          }
        />
        <Button type="submit" disabled={busy}>
          {busy ? t.submitting : t.submit}
        </Button>
      </form>
      <details className="rounded-lg border border-line bg-surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ink">{t.refuseTitle}</summary>
        <p className="mb-4 mt-1 text-sm text-ink-muted">{t.refuseBody}</p>
        {refuse}
      </details>
    </section>
  );
}
