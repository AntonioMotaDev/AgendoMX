import { ChevronRight, ImageIcon, Link2, MapPin, Palette, Settings2, Share2, UserCog, Users, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { BusinessAvatar } from "@/components/dashboard/business-avatar";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { categoryLabel } from "@/lib/categories";
import { getCurrentBusiness } from "@/lib/session";

export const metadata: Metadata = { title: "Perfil — AgendoMX", robots: { index: false } };

const t = copy.panel.profile;

const SECTIONS: Array<{ href: string; title: string; hint: string; Icon: LucideIcon }> = [
  { href: "/app/perfil/imagenes", ...t.sections.images, Icon: ImageIcon },
  { href: "/app/perfil/apariencia", ...t.sections.appearance, Icon: Palette },
  { href: "/app/perfil/informacion", ...t.sections.info, Icon: MapPin },
  { href: "/app/perfil/redes", ...t.sections.social, Icon: Share2 },
  { href: "/app/perfil/link", ...t.sections.link, Icon: Link2 },
  { href: "/app/perfil/reservaciones", ...t.sections.booking, Icon: Settings2 },
  { href: "/app/perfil/clientes", ...t.sections.clients, Icon: Users },
  { href: "/app/perfil/cuenta", ...t.sections.account, Icon: UserCog },
];

export default async function ProfilePage() {
  const business = (await getCurrentBusiness())!; // the panel layout guarantees it
  const host = new URL(appUrl()).host;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-base text-ink-muted">{t.subtitle}</p>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
        <BusinessAvatar name={business.name} logoUrl={business.logoUrl} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-ink">{business.name}</p>
          <p className="text-sm text-ink-muted">
            {categoryLabel(business.category, business.categoryOther, copy.onboarding.categories)}
            {business.city ? ` · ${business.city}` : ""}
          </p>
          <p className="mt-1 break-all text-sm font-medium text-ink">
            {host}/{business.slug}
          </p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {SECTIONS.map(({ href, title, hint, Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-paper">
              <Icon aria-hidden="true" className="h-6 w-6 shrink-0 text-ink-muted" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-medium text-ink">{title}</span>
                <span className="text-sm text-ink-muted">{hint}</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>

      {/* On wide screens the sidebar already has this button. */}
      <div className="lg:hidden">
        <LogoutButton />
      </div>
    </section>
  );
}
