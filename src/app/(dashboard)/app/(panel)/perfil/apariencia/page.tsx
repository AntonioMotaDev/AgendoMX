import type { Metadata } from "next";
import { ProfileSubpage } from "@/components/dashboard/profile-subpage";
import { ThemePicker } from "@/components/dashboard/theme-picker";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";
import { themeOrDefault } from "@/lib/themes";

export const metadata: Metadata = { title: "Apariencia — AgendoMX", robots: { index: false } };

export default async function AppearancePage() {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  return (
    <ProfileSubpage title={copy.panel.profile.appearance.title} subtitle={copy.panel.profile.appearance.subtitle} wide>
      <ThemePicker initial={themeOrDefault(business.theme)} slug={business.slug} />
    </ProfileSubpage>
  );
}
