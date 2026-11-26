import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";

/** Shared frame for the screens under Perfil: back link, title and a phone-width column. */
export function ProfileSubpage({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`mx-auto flex w-full flex-col gap-5 ${wide ? "max-w-3xl" : "max-w-md"}`}>
      <Link href="/app/perfil" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-ink">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {copy.panel.profile.back}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-base text-ink-muted">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
