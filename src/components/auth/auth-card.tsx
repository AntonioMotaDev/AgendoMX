import type { ReactNode } from "react";
import { Illustration } from "@/components/illustrations/illustration";
import { Isotipo, Logo } from "@/components/ui/logo";
import { copy } from "@/lib/copy";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-4 lg:p-4">
      <div className="flex flex-1 flex-col items-center px-4 py-10 sm:justify-center lg:py-0">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          {/* Compact illustration for phones and tablets; the large panel takes over from lg. */}
          <div className="mb-6 overflow-hidden rounded-lg lg:hidden">
            <Illustration kind="strip" className="max-h-24" />
          </div>
          <div className="rounded-panel border border-line bg-surface p-6 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-2 text-base text-ink-muted">{subtitle}</p> : null}
            <div className="mt-6 flex flex-col gap-5">{children}</div>
          </div>
        </div>
      </div>
      <aside className="hidden flex-col justify-between overflow-hidden rounded-panel bg-ink p-10 text-paper lg:flex" aria-label={copy.auth.aside.label}>
        <p className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-paper">
          <Isotipo className="h-7 w-7 text-brand" />
          <span>
            agendo<span className="text-brand">mx</span>
          </span>
        </p>
        <Illustration kind="hero" tone="dark" className="my-8" />
        <div>
          <p className="text-3xl font-bold leading-tight tracking-tight">{copy.tagline}</p>
          <p className="mt-3 max-w-md text-base text-stone">{copy.auth.aside.body}</p>
        </div>
      </aside>
    </main>
  );
}
