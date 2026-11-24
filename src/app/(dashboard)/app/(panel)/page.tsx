import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";

export const metadata: Metadata = { title: "Hoy — AgendoMX", robots: { index: false } };

// Placeholder until the agenda exists (Fase 4). The layout guarantees a finished onboarding.
export default async function TodayPage() {
  const business = await getCurrentBusiness();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.dashboard.todayTitle}</h1>
      <p className="text-base text-ink-muted">{business?.name}</p>
      <p className="mt-4 text-base text-ink">{copy.dashboard.emptyToday}</p>
      <p className="text-base text-ink-muted">{copy.dashboard.emptyTodayHint}</p>
    </section>
  );
}
