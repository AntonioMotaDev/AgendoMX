import { redirect } from "next/navigation";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { PanelNav } from "@/components/dashboard/panel-nav";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy";
import { legalPublished } from "@/lib/legal";
import { getCurrentBusiness } from "@/lib/session";
import { publicBookingRequirements } from "@/server/services/booking";
import Link from "next/link";

/** Every panel screen needs a finished onboarding; until then the owner is sent to finish it. */
export default async function PanelLayout({ children }: LayoutProps<"/app">) {
  const business = await getCurrentBusiness();
  if (!business || !business.onboardingCompletedAt) redirect("/app/onboarding");
  // While the legal texts are published, a business needs its address and a contact to take online bookings.
  const { missing } = publicBookingRequirements(legalPublished(), business);
  return (
    <>
      <ServiceWorkerRegister />
      <PanelNav />
      <InstallPrompt />
      {missing.length > 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-4">
          <Alert tone="info">
            <p className="font-semibold">{copy.panel.legal.missing.title}</p>
            <p className="mt-1">{copy.panel.legal.missing.body(missing)}</p>
            <Link href="/app/perfil/informacion" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-ink underline underline-offset-2">
              {copy.panel.legal.missing.cta}
            </Link>
          </Alert>
        </div>
      ) : null}
      {/* Room for the fixed bottom bar on phones. */}
      <div className="pb-24 md:pb-0">{children}</div>
    </>
  );
}
