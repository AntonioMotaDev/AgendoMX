import { BusinessAvatar } from "@/components/dashboard/business-avatar";
import { CoverArt } from "@/components/public/cover-art";
import type { BusinessTheme } from "@/lib/themes";

/**
 * Header of the owner panel: the business cover (or the theme's time-block art) with its name.
 * Must render inside an element carrying `data-theme-biz` (the panel layout does).
 */
export function PanelBanner({ business }: { business: { name: string; logoUrl: string | null; coverUrl: string | null; theme: BusinessTheme } }) {
  return (
    <div className="relative mb-5 h-16 overflow-hidden rounded-panel border border-th-line bg-th-cover sm:h-20">
      {business.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own /media route, already compressed
        <img src={business.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <CoverArt theme={business.theme} className="absolute inset-0 h-full w-full" />
      )}
      <div className="relative flex h-full items-center px-3 sm:px-4">
        <p className="flex min-w-0 items-center gap-2.5 rounded-full border border-th-line bg-th-surface/95 py-1.5 pl-1.5 pr-4 text-th-text">
          <BusinessAvatar name={business.name} logoUrl={business.logoUrl} className="h-9 w-9 text-sm" />
          <span className="truncate text-sm font-bold">{business.name}</span>
        </p>
      </div>
    </div>
  );
}
