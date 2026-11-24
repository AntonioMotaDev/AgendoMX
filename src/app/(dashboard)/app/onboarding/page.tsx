import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { BusinessStepForm } from "@/components/onboarding/business-step-form";
import { DoneStep } from "@/components/onboarding/done-step";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ScheduleStepForm } from "@/components/onboarding/schedule-step-form";
import { ServiceStepForm } from "@/components/onboarding/service-step-form";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { MX_STATES } from "@/lib/mx-states";
import { getCurrentBusiness, requireOwner } from "@/lib/session";
import { getFirstService, getOnboardingState, getPrimaryStaff, getScheduleRules } from "@/server/queries/business";
import { applyPreset, rulesToSchedule, SCHEDULE_PRESETS } from "@/server/services/schedule";

export const metadata: Metadata = { title: "Configura tu negocio — AgendoMX", robots: { index: false } };

const c = copy.onboarding;

function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export default async function OnboardingPage({ searchParams }: PageProps<"/app/onboarding">) {
  const owner = await requireOwner();
  const db = await getDb();
  const state = await getOnboardingState(db, owner.id);

  // Furthest step the owner can reach: they cannot skip ahead of what is saved.
  const maxStep = !state.hasBusiness ? 1 : !state.hasService ? 2 : state.completed ? 4 : 3;
  const { paso } = await searchParams;
  const requested = typeof paso === "string" && /^[1-4]$/.test(paso) ? Number(paso) : undefined;

  if (state.completed && requested === undefined) redirect("/app");
  const step = Math.min(requested ?? maxStep, maxStep);

  const business = await getCurrentBusiness();
  const host = new URL(appUrl()).host;

  if (step === 1) {
    return (
      <OnboardingShell step={1} title={c.business.title} subtitle={c.business.subtitle}>
        <BusinessStepForm
          publicHost={host}
          initial={
            business
              ? { name: business.name, category: business.category, state: MX_STATES.find((s) => s === business.state), city: business.city ?? "", slug: business.slug }
              : {}
          }
        />
      </OnboardingShell>
    );
  }

  // Steps 2–4 need a business; maxStep >= 2 guarantees it exists.
  if (!business) redirect("/app/onboarding");

  if (step === 2) {
    const service = await getFirstService(db, business.id);
    return (
      <OnboardingShell step={2} title={c.service.title} subtitle={c.service.subtitle}>
        <ServiceStepForm
          initial={{ name: service?.name ?? "", price: centsToInput(service?.priceCents ?? null), durationMin: service?.durationMin ?? 30 }}
        />
      </OnboardingShell>
    );
  }

  if (step === 3) {
    const staff = await getPrimaryStaff(db, business.id);
    const rules = staff ? await getScheduleRules(db, staff.id) : [];
    return (
      <OnboardingShell step={3} title={c.schedule.title} subtitle={c.schedule.subtitle}>
        <ScheduleStepForm initial={rules.length > 0 ? rulesToSchedule(rules) : applyPreset(SCHEDULE_PRESETS[0]!)} />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={4} title={c.done.title} subtitle={c.done.subtitle}>
      <DoneStep publicUrl={`${appUrl()}/${business.slug}`} publicHost={host} slug={business.slug} businessName={business.name} />
    </OnboardingShell>
  );
}
