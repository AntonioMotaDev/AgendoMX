import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: `${copy.pwa.offlineTitle} — AgendoMX`, robots: { index: false } };

// Precached by the service worker and shown when a page cannot be reached. No data, no session: safe to cache.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Logo />
      <h1 className="text-xl font-semibold text-ink">{copy.pwa.offlineTitle}</h1>
      <p className="text-base text-ink-muted">{copy.pwa.offlineBody}</p>
      {/* A plain GET form, not a JS handler: this page is served from cache while offline, where its client chunks are not available.
          The document URL is the page that failed, so submitting simply asks for it again. */}
      <form method="get">
        <Button type="submit" className="sm:w-auto">
          {copy.pwa.retry}
        </Button>
      </form>
    </main>
  );
}
