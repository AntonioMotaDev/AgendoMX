import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/dashboard/delete-account-form";
import { ProfileSubpage } from "@/components/dashboard/profile-subpage";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { requireOwner } from "@/lib/session";
import { getAccountSummary } from "@/server/actions/account-writes";

export const metadata: Metadata = { title: "Mi cuenta — AgendoMX", robots: { index: false } };

const t = copy.panel.profile.account;

export default async function AccountPage() {
  const owner = await requireOwner();
  const summary = await getAccountSummary(await getDb(), owner.id, new Date());
  if (!summary) return null; // the session outlived the account: the next request redirects to login

  return (
    <ProfileSubpage title={t.title} subtitle={t.subtitle}>
      <p className="text-sm text-ink-muted">
        {t.emailLabel}: <span className="font-medium text-ink">{summary.email}</span>
      </p>
      <DeleteAccountForm expected={summary.businessName ?? summary.email} summary={summary} />
    </ProfileSubpage>
  );
}
