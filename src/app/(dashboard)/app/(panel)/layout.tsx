import { redirect } from "next/navigation";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { PanelNav } from "@/components/dashboard/panel-nav";
import { getCurrentBusiness } from "@/lib/session";

/** Every panel screen needs a finished onboarding; until then the owner is sent to finish it. */
export default async function PanelLayout({ children }: LayoutProps<"/app">) {
  const business = await getCurrentBusiness();
  if (!business || !business.onboardingCompletedAt) redirect("/app/onboarding");
  return (
    <>
      <ServiceWorkerRegister />
      <PanelNav />
      <InstallPrompt />
      {/* Room for the fixed bottom bar on phones. */}
      <div className="pb-24 md:pb-0">{children}</div>
    </>
  );
}
