import type { Metadata } from "next";
import { ProfileInfoForm } from "@/components/dashboard/profile-info-form";
import { ProfileSubpage } from "@/components/dashboard/profile-subpage";
import { copy } from "@/lib/copy";
import { MX_STATES } from "@/lib/mx-states";
import { formatMxPhoneForInput } from "@/lib/phone";
import { legalSwitches } from "@/lib/legal";
import { getCurrentBusiness } from "@/lib/session";
import { selectableCategories } from "@/server/services/booking";

export const metadata: Metadata = { title: "Información y contacto — AgendoMX", robots: { index: false } };

export default async function ProfileInfoPage() {
  const business = (await getCurrentBusiness())!;
  return (
    <ProfileSubpage title={copy.panel.profile.info.title}>
      <ProfileInfoForm
        categories={selectableCategories(legalSwitches(), business.category)}
        initial={{
          name: business.name,
          category: business.category,
          categoryOther: business.categoryOther ?? "",
          state: MX_STATES.find((s) => s === business.state),
          city: business.city ?? "",
          description: business.description ?? "",
          address: business.address ?? "",
          mapsUrl: business.mapsUrl ?? "",
          phone: formatMxPhoneForInput(business.phone),
          whatsapp: formatMxPhoneForInput(business.whatsapp),
          email: business.email ?? "",
        }}
      />
    </ProfileSubpage>
  );
}
