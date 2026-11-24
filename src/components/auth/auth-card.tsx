import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-panel border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-base text-ink-muted">{subtitle}</p> : null}
          <div className="mt-6 flex flex-col gap-5">{children}</div>
        </div>
      </div>
    </main>
  );
}
