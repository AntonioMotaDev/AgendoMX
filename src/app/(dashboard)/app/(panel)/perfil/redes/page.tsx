import type { Metadata } from "next";
import { ProfileSubpage } from "@/components/dashboard/profile-subpage";
import { SocialLinksForm } from "@/components/dashboard/social-links-form";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";

export const metadata: Metadata = { title: "Redes sociales — AgendoMX", robots: { index: false } };

export default async function SocialPage() {
  const b = (await getCurrentBusiness())!;
  return (
    <ProfileSubpage title={copy.panel.profile.social.title} subtitle={copy.panel.profile.social.subtitle}>
      <SocialLinksForm
        initial={{
          instagram: b.instagramUrl ?? "",
          facebook: b.facebookUrl ?? "",
          tiktok: b.tiktokUrl ?? "",
          youtube: b.youtubeUrl ?? "",
          twitter: b.twitterUrl ?? "",
          linkedin: b.linkedinUrl ?? "",
        }}
      />
    </ProfileSubpage>
  );
}
