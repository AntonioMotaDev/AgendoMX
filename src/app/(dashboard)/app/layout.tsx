import { LogoutButton } from "@/components/auth/logout-button";
import { DeleteAccountForm } from "@/components/dashboard/delete-account-form";
import { AcceptTermsGate } from "@/components/legal/accept-terms-gate";
import { Logo } from "@/components/ui/logo";
import { getDb } from "@/db";
import { legalPublished } from "@/lib/legal";
import { LEGAL_VERSION } from "@/lib/legal-content";
import { requireOwner } from "@/lib/session";
import { getAccountSummary } from "@/server/actions/account-writes";

export default async function DashboardLayout({ children }: LayoutProps<"/app">) {
  const owner = await requireOwner();

  // While the legal texts are published, the panel waits until the owner has accepted the current version.
  // Refusing stays possible: sign out (header) or delete the account (inside the gate).
  let gate = null;
  if (legalPublished() && owner.termsVersion !== LEGAL_VERSION) {
    const summary = await getAccountSummary(await getDb(), owner.id, new Date());
    gate = summary ? <AcceptTermsGate version={LEGAL_VERSION} refuse={<DeleteAccountForm expected={summary.businessName ?? summary.email} summary={summary} />} /> : null;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <Logo className="text-xl" />
        <LogoutButton />
      </header>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{gate ?? children}</div>
    </div>
  );
}
