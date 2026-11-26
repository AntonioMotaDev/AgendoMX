import { copy } from "@/lib/copy";
import type { BusinessTheme } from "@/lib/themes";
import { CoverArt } from "./cover-art";

/** A tiny, non-interactive profile drawn with one theme's tokens. Only used by the theme picker. */
export function ThemeMini({ theme }: { theme: BusinessTheme }) {
  return (
    <div data-theme-biz={theme} aria-hidden="true" className="overflow-hidden rounded-[14px] bg-th-bg pb-3 text-th-text">
      <div className="h-14">
        <CoverArt theme={theme} />
      </div>
      <div className="relative -mt-4 ml-3 h-8 w-8 rounded-full border-[3px] border-th-bg bg-th-primary" />
      <div className="mt-2 grid gap-1.5 px-3">
        <i className="block h-1.5 w-[55%] rounded-full bg-th-text opacity-80" />
        <i className="block h-1.5 w-[80%] rounded-full bg-th-muted opacity-50" />
      </div>
      <div className="mx-3 mt-2.5 h-5 rounded-lg border border-th-line bg-th-surface" />
      <div className="mx-3 mt-2 rounded-lg bg-th-primary text-center text-[10px] font-bold leading-[22px] text-th-onp">{copy.panel.profile.appearance.previewCta}</div>
    </div>
  );
}
