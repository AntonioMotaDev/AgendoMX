import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookBar, BookingCard, InfoPanel, ProfileCover, ProfileIdentity, QuickActions, ServicesPanel } from "@/components/public/profile-sections";
import { ProfileTabs } from "@/components/public/profile-tabs";
import { ThemeScope } from "@/components/public/theme-scope";
import { getDb } from "@/db";
import { categoryLabel } from "@/lib/categories";
import { copy } from "@/lib/copy";
import { appUrl } from "@/lib/env";
import { legalPublished } from "@/lib/legal";
import { toLocalDate, weekdayOf } from "@/lib/time";
import { getPublicBusinessBySlug, getPublicHours, listPublicServices } from "@/server/queries/public";

const t = copy.public.profile;

async function load(slug: string) {
  const db = await getDb();
  const found = await getPublicBusinessBySlug(db, slug);
  if (!found) return null;
  const [services, hours] = await Promise.all([listPublicServices(db, found.businessId), getPublicHours(db, found.businessId)]);
  return { ...found.business, services, hours };
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

  const canBook = business.services.length > 0;
  const todayWeekday = weekdayOf(toLocalDate(new Date(), business.timezone));

  return (
    <ThemeScope theme={business.theme}>
      <main className={`mx-auto w-full max-w-[1100px] flex-1 sm:px-7 sm:pt-5 lg:px-8 lg:pt-6 ${canBook ? "pb-28 lg:pb-12" : "pb-12"}`}>
        <ProfileCover business={business} />
        <div className="grid gap-6 px-4 sm:px-[22px] lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-x-10 lg:px-6">
          <div className="flex min-w-0 flex-col gap-4">
            <ProfileIdentity business={business} />
            <QuickActions business={business} />
            <ProfileTabs
              labels={{ group: t.tabsLabel, services: t.tabServices, info: t.tabInfo }}
              services={<ServicesPanel slug={business.slug} services={business.services} />}
              info={<InfoPanel business={business} hours={business.hours} todayWeekday={todayWeekday} />}
            />
          </div>
          {canBook ? (
            <aside className="hidden lg:mt-5 lg:block">
              <BookingCard slug={business.slug} cancellationMinHours={business.cancellationMinHours} city={business.city} />
            </aside>
          ) : null}
        </div>
        <footer className="mt-10 flex flex-col items-center gap-1 px-4 text-center text-xs text-th-muted">
          {legalPublished() ? (
            <Link href={`/${business.slug}/privacidad`} className="underline underline-offset-2">
              {t.privacyLink}
            </Link>
          ) : null}
          {t.powered}
        </footer>
      </main>
      {canBook ? <BookBar slug={business.slug} /> : null}
    </ThemeScope>
  );
}
