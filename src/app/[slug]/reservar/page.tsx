import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { ThemeScope } from "@/components/public/theme-scope";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { optionalEnv } from "@/lib/env";
import { legalPublished } from "@/lib/legal";
import { fillClientNotice, LEGAL_TEXTS } from "@/lib/legal-content";
import { turnstileMode } from "@/lib/turnstile";
import { turnstileConfig } from "@/lib/turnstile-config";
import { getPublicBusinessBySlug, listPublicServices } from "@/server/queries/public";

export const metadata: Metadata = { title: copy.public.booking.title, robots: { index: false } };

export default async function BookingPage({ params, searchParams }: PageProps<"/[slug]/reservar">) {
  const { slug } = await params;
  const query = await searchParams;
  const db = await getDb();
  const found = await getPublicBusinessBySlug(db, slug);
  if (!found) notFound();
  const services = await listPublicServices(db, found.businessId);
  if (services.length === 0) redirect(`/${found.business.slug}`);

  const preselected = typeof query.servicio === "string" ? query.servicio : null;
  const config = turnstileConfig();
  // Production-like runtimes without keys refuse bookings on the server; the page just does not render the widget.
  const siteKey = turnstileMode(config) === "enforce" ? (optionalEnv("TURNSTILE_SITE_KEY") ?? null) : null;

  const place = [found.business.address, found.business.city].filter(Boolean).join(", ") || null;

  return (
    <ThemeScope theme={found.business.theme}>
      <BookingWizard
        slug={found.business.slug}
        businessName={found.business.name}
        businessPlace={place}
        services={services}
        preselectedServiceId={preselected}
        manualConfirmation={found.business.confirmationMode === "manual"}
        turnstileSiteKey={siteKey}
        privacyNotice={legalPublished() ? fillClientNotice(LEGAL_TEXTS.privacyClientsShort, found.business) : null}
      />
    </ThemeScope>
  );
}
