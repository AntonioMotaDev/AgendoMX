import type { ReactNode } from "react";
import type { BusinessTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Applies a business theme (`--t-*` tokens, see globals.css) to everything inside.
 * Used by the public profile, the booking flow and the client's appointment page.
 * The owner panel never uses it: it always keeps the neutral AgendoMX interface.
 */
export function ThemeScope({ theme, className, children }: { theme: BusinessTheme; className?: string; children: ReactNode }) {
  return (
    <div data-theme-biz={theme} className={cn("flex min-h-dvh flex-1 flex-col bg-th-bg text-th-text", className)}>
      {children}
    </div>
  );
}
