import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";

export const metadata: Metadata = { title: "Hoy — AgendoMX", robots: { index: false } };

// Placeholder until onboarding (Fase 2) and the agenda (Fase 4) exist.
export default async function TodayPage() {
  const business = await getCurrentBusiness();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.dashboard.todayTitle}</h1>
      <p className="text-base text-ink">{business ? copy.dashboard.emptyToday : copy.dashboard.onboardingPending}</p>
      {business ? <p className="text-base text-ink-muted">{copy.dashboard.emptyTodayHint}</p> : null}
    </section>
  );
}
