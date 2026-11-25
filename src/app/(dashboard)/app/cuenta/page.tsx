import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountForm } from "@/components/dashboard/delete-account-form";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { requireOwner } from "@/lib/session";
import { getAccountSummary } from "@/server/actions/account-writes";

export const metadata: Metadata = { title: "Eliminar mi cuenta — AgendoMX", robots: { index: false } };

const t = copy.panel.profile.account;

/**
 * Account deletion outside the panel: an owner who never finished onboarding has no Perfil menu
 * (it needs a business), so this is their way to exercise the right to cancel their data.
 */
export default async function OwnerAccountPage() {
  const owner = await requireOwner();
  const summary = await getAccountSummary(await getDb(), owner.id, new Date());
  if (!summary) return null; // the session outlived the account: the next request redirects to login

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <Link href="/app" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-ink">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {copy.onboarding.shell.back}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-base text-ink-muted">{t.subtitle}</p>
      </div>
      <p className="text-sm text-ink-muted">
        {t.emailLabel}: <span className="font-medium text-ink">{summary.email}</span>
      </p>
      <DeleteAccountForm expected={summary.businessName ?? summary.email} summary={summary} />
    </section>
  );
}
