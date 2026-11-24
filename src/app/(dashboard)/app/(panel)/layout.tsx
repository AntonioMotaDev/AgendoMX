import { redirect } from "next/navigation";
import { PanelNav } from "@/components/dashboard/panel-nav";
import { getCurrentBusiness } from "@/lib/session";

/** Every panel screen needs a finished onboarding; until then the owner is sent to finish it. */
export default async function PanelLayout({ children }: LayoutProps<"/app">) {
  const business = await getCurrentBusiness();
  if (!business || !business.onboardingCompletedAt) redirect("/app/onboarding");
  return (
    <>
      <PanelNav />
      {/* Room for the fixed bottom bar on phones. */}
      <div className="pb-24 md:pb-0">{children}</div>
    </>
  );
}
