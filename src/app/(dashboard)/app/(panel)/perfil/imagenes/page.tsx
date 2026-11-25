import type { Metadata } from "next";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { ProfileSubpage } from "@/components/dashboard/profile-subpage";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";

export const metadata: Metadata = { title: "Logo y portada — AgendoMX", robots: { index: false } };

export default async function ImagesPage() {
  const business = (await getCurrentBusiness())!;
  const t = copy.panel.profile.images;
  return (
    <ProfileSubpage title={t.title} subtitle={t.subtitle}>
      <ImageUploader kind="logo" currentUrl={business.logoUrl} businessName={business.name} />
      <ImageUploader kind="cover" currentUrl={business.coverUrl} businessName={business.name} />
    </ProfileSubpage>
  );
}
