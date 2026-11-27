"use client";

import { CalendarDays, Clock, Scissors, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BusinessAvatar } from "@/components/dashboard/business-avatar";
import { LogoutButton } from "@/components/auth/logout-button";
import { Isotipo } from "@/components/ui/logo";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const c = copy.panel.nav;

const ITEMS: Array<{ href: string; label: string; Icon: LucideIcon; exact?: boolean }> = [
  { href: "/app", label: c.today, Icon: CalendarDays, exact: true },
  { href: "/app/servicios", label: c.services, Icon: Scissors },
  { href: "/app/horarios", label: c.schedule, Icon: Clock },
  { href: "/app/perfil", label: c.profile, Icon: Store },
];

interface Props {
  business: { name: string; slug: string; logoUrl: string | null };
  publicHost: string;
}

/**
 * One navigation, three shapes: a bar at the bottom on phones, a rail of icons on
 * tablets held upright, and a sidebar with names from 1024px (iPad on its side, computers).
 */
export function PanelNav({ business, publicHost }: Props) {
  const pathname = usePathname();
  // "Mañana", "Semana" and "Nueva cita" belong to the agenda, so they keep "Hoy" lit.
  const isActive = (item: (typeof ITEMS)[number]) =>
    item.exact ? pathname === item.href || pathname.startsWith("/app/manana") || pathname.startsWith("/app/semana") || pathname.startsWith("/app/citas") : pathname.startsWith(item.href);

  return (
    <nav
      aria-label={c.label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur",
        "sm:sticky sm:inset-x-auto sm:top-0 sm:flex sm:h-dvh sm:w-[92px] sm:shrink-0 sm:flex-col sm:gap-6 sm:self-start sm:border-r sm:border-t-0 sm:bg-surface sm:px-2.5 sm:py-5 sm:backdrop-blur-none",
        "lg:w-[248px] lg:px-3.5",
      )}
    >
      <Link href="/app" aria-label="AgendoMX" className="hidden items-center justify-center gap-2.5 text-ink sm:flex lg:justify-start lg:px-2.5">
        <Isotipo className="h-8 w-8 text-brand" />
        <span className="hidden text-[22px] font-extrabold tracking-tight lg:inline">
          agendo<span className="text-brand">mx</span>
        </span>
      </Link>

      <ul className="grid grid-cols-4 sm:flex sm:flex-col sm:gap-1.5">
        {ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                  "sm:min-h-16 sm:rounded-2xl",
                  "lg:min-h-[46px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:text-sm",
                  active ? "text-ink sm:bg-pa-soft" : "text-ink-muted hover:text-ink",
                )}
              >
                {active ? <span aria-hidden="true" className="absolute left-1/2 top-[-1px] h-[3px] w-7 -translate-x-1/2 rounded-b-sm bg-pa sm:hidden" /> : null}
                <item.Icon aria-hidden="true" className={cn("h-6 w-6 lg:h-5 lg:w-5", active && "text-pa")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto hidden flex-col gap-2 lg:flex">
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-paper p-3">
          <BusinessAvatar name={business.name} logoUrl={business.logoUrl} className="h-[38px] w-[38px] text-base" />
          <div className="min-w-0">
            <b className="block truncate text-sm">{business.name}</b>
            <span className="block truncate text-xs text-ink-muted">
              {publicHost}/{business.slug}
            </span>
          </div>
        </div>
        <LogoutButton />
      </div>
    </nav>
  );
}
