import type { Metadata } from "next";
import { ChangeSlugForm } from "@/components/dashboard/change-slug-form";
import { ProfileSubpage } from "@/components/dashboard/profile-subpage";
import { QrCard, ShareLinkCard } from "@/components/dashboard/share-cards";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { getCurrentBusiness } from "@/lib/session";

export const metadata: Metadata = { title: "Tu link y código QR — AgendoMX", robots: { index: false } };

export default async function LinkPage() {
  const business = (await getCurrentBusiness())!;
  const host = new URL(appUrl()).host;
  const publicUrl = `${appUrl()}/${business.slug}`;
  return (
    <ProfileSubpage title={copy.panel.profile.link.title}>
      <ShareLinkCard publicUrl={publicUrl} publicHost={host} slug={business.slug} businessName={business.name} />
      <QrCard publicUrl={publicUrl} publicHost={host} slug={business.slug} />
      <ChangeSlugForm key={business.slug} currentSlug={business.slug} publicHost={host} />
    </ProfileSubpage>
  );
}
