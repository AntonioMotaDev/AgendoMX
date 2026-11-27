import { redirect } from "next/navigation";
import { PanelBanner } from "@/components/dashboard/panel-banner";
import { PanelNav } from "@/components/dashboard/panel-nav";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { appUrl } from "@/lib/env";
import { getCurrentBusiness } from "@/lib/session";
import { themeOrDefault } from "@/lib/themes";

/** Every panel screen needs a finished onboarding; until then the owner is sent to finish it. */
export default async function PanelLayout({ children }: LayoutProps<"/app">) {
  const business = await getCurrentBusiness();
  if (!business || !business.onboardingCompletedAt) redirect("/app/onboarding");
  const theme = themeOrDefault(business.theme);
  return (
    // `data-theme-biz` + `data-panel-theme`: only the accent (--pa) and the banner follow the business theme (globals.css).
    <div data-theme-biz={theme} data-panel-theme="" className="flex min-h-dvh flex-1 flex-col sm:flex-row">
      <ServiceWorkerRegister />
      <PanelNav business={{ name: business.name, slug: business.slug, logoUrl: business.logoUrl }} publicHost={new URL(appUrl()).host} />
      <div className="min-w-0 flex-1">
        <InstallPrompt />
        {/* Room at the bottom for the fixed bar on phones. */}
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-5 sm:px-7 sm:pb-10 sm:pt-7 lg:px-9">
          <PanelBanner business={{ name: business.name, logoUrl: business.logoUrl, coverUrl: business.coverUrl, theme }} />
          {children}
        </div>
      </div>
    </div>
  );
}
