import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";

const c = copy.onboarding;
export const ONBOARDING_STEPS = 4;

/** Progress, title and back link shared by every onboarding step. */
export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {step > 1 && step < ONBOARDING_STEPS ? (
            <Link href={`/app/onboarding?paso=${step - 1}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {c.shell.back}
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-ink-muted">{c.shell.step(step, ONBOARDING_STEPS)}</p>
        </div>
        <div
          role="progressbar"
          aria-label={c.shell.step(step, ONBOARDING_STEPS)}
          aria-valuemin={1}
          aria-valuemax={ONBOARDING_STEPS}
          aria-valuenow={step}
          className="flex gap-1.5"
        >
          {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
            <span key={i} className={i < step ? "h-1.5 flex-1 rounded-full bg-brand" : "h-1.5 flex-1 rounded-full bg-line"} />
          ))}
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-base text-ink-muted">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
