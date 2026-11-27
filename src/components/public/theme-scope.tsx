import type { ReactNode } from "react";
import type { BusinessTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Applies a business theme (`--t-*` tokens, see globals.css) to everything inside.
 * Used by the public profile, the booking flow and the client's appointment page.
 * The owner panel does not use it: it keeps the neutral AgendoMX interface and only takes the theme's accent and header (see `data-panel-theme` in globals.css).
 */
export function ThemeScope({ theme, className, children }: { theme: BusinessTheme; className?: string; children: ReactNode }) {
  return (
    <div data-theme-biz={theme} className={cn("flex min-h-dvh flex-1 flex-col bg-th-bg text-th-text", className)}>
      {children}
    </div>
  );
}
