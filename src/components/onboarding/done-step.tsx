import Link from "next/link";
import { Illustration } from "@/components/illustrations/illustration";
import { QrCard, ShareLinkCard } from "@/components/dashboard/share-cards";
import { copy } from "@/lib/copy";

const c = copy.onboarding.done;

export function DoneStep({ publicUrl, publicHost, slug, businessName }: { publicUrl: string; publicHost: string; slug: string; businessName: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-panel border border-line">
        <Illustration kind="done" animated />
      </div>
      <ShareLinkCard publicUrl={publicUrl} publicHost={publicHost} slug={slug} businessName={businessName} />
      <QrCard publicUrl={publicUrl} publicHost={publicHost} slug={slug} />
      <Link
        href="/app"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-base font-semibold text-surface hover:bg-ink/90"
      >
        {c.goToBusiness}
      </Link>
    </div>
  );
}
