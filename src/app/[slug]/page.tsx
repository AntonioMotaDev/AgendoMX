import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactSection, LocationSection, ProfileHero, ServicesSection } from "@/components/public/profile-sections";
import { getDb } from "@/db";
import { categoryLabel } from "@/lib/categories";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { legalPublished } from "@/lib/legal";
import { getPublicBusinessBySlug, listPublicServices } from "@/server/queries/public";
import { publicBookingRequirements } from "@/server/services/booking";

const t = copy.public.profile;

async function load(slug: string) {
  const db = await getDb();
  const found = await getPublicBusinessBySlug(db, slug);
  if (!found) return null;
  const services = await listPublicServices(db, found.businessId);
  return { ...found.business, services };
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const business = await load(slug);
  if (!business) return { title: "AgendoMX", robots: { index: false } };
  const kind = categoryLabel(business.category, business.categoryOther, copy.onboarding.categories);
  const description = business.description?.slice(0, 160) ?? `Agenda tu cita en ${business.name}${business.city ? `, ${business.city}` : ""}. ${kind}.`;
  const image = business.coverUrl ?? business.logoUrl;
  return {
    title: `${business.name} — ${t.book}`,
    description,
    alternates: { canonical: `${appUrl()}/${business.slug}` },
    openGraph: {
      title: business.name,
      description,
      url: `${appUrl()}/${business.slug}`,
      siteName: "AgendoMX",
      locale: "es_MX",
      type: "website",
      ...(image ? { images: [{ url: `${appUrl()}${image}` }] } : {}),
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const business = await load(slug);
  if (!business) notFound();

  // While the legal texts are published, a business without address and contact cannot take online bookings.
  const identityMissing = publicBookingRequirements(legalPublished(), business).closed;
  const canBook = business.services.length > 0 && !identityMissing;
  return (
    <main className="flex-1 pb-28">
      <ProfileHero business={business} />
      <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-8 px-4">
        {identityMissing ? <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{t.bookingClosed}</p> : null}
        <ServicesSection slug={business.slug} services={business.services} bookable={!identityMissing} />
        <LocationSection business={business} />
        <ContactSection business={business} />
        <p className="text-sm text-ink-muted">{t.cancellation(business.cancellationMinHours)}</p>
        {business.cancellationPolicyText ? <p className="whitespace-pre-line text-sm text-ink-muted">{business.cancellationPolicyText}</p> : null}
        <footer className="flex flex-col items-center gap-1 border-t border-line pt-4 text-center text-xs text-ink-muted">
          {legalPublished() ? (
            <Link href={`/${business.slug}/privacidad`} className="underline underline-offset-2">
              {t.privacyLink}
            </Link>
          ) : null}
          {t.powered}
        </footer>
      </div>
      {canBook ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <Link
              href={`/${business.slug}/reservar`}
              className="flex min-h-12 w-full items-center justify-center rounded-md bg-ink px-5 text-base font-semibold text-surface hover:bg-ink/90"
            >
              {t.book}
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
