"use client";

import { CalendarDays, Clock, Store, Tags, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const c = copy.panel.nav;

const ITEMS: Array<{ href: string; label: string; Icon: LucideIcon; exact?: boolean }> = [
  { href: "/app", label: c.today, Icon: CalendarDays, exact: true },
  { href: "/app/servicios", label: c.services, Icon: Tags },
  { href: "/app/horarios", label: c.schedule, Icon: Clock },
  { href: "/app/perfil", label: c.profile, Icon: Store },
];

/** Bottom tab bar on phones, tabs under the header on larger screens. Same links, one visible at a time. */
export function PanelNav() {
  const pathname = usePathname();
  // "Mañana" and "Semana" are tabs of the agenda, so they keep "Hoy" lit.
  const isActive = (item: (typeof ITEMS)[number]) => (item.exact ? pathname === item.href || pathname.startsWith("/app/manana") || pathname.startsWith("/app/semana") : pathname.startsWith(item.href));

  return (
    <>
      <nav aria-label={c.label} className="mb-6 hidden gap-1 border-b border-line md:flex">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item) ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-base font-medium",
              isActive(item) ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <item.Icon aria-hidden="true" className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <nav
        aria-label={c.label}
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item) ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
              isActive(item) ? "text-ink" : "text-ink-muted",
            )}
          >
            <item.Icon aria-hidden="true" className={cn("h-6 w-6", isActive(item) && "text-brand-ink")} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
