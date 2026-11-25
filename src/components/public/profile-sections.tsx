import { Clock, ExternalLink, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { BusinessAvatar } from "@/components/dashboard/business-avatar";
import { categoryLabel } from "@/lib/categories";
import { copy } from "@/lib/copy";
import { extractCoords } from "@/lib/maps";
import { formatMxnShort } from "@/lib/money";
import { directionsLink, osmEmbedUrl, telLink, whatsappLink } from "@/lib/public-links";
import { formatMxPhoneForInput } from "@/lib/phone";
import type { PublicBusiness, PublicService } from "@/server/queries/public";

const t = copy.public.profile;
const labels = copy.onboarding.categories;

export function ProfileHero({ business }: { business: PublicBusiness }) {
  return (
    <header>
      {business.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own /media route, already compressed
        <img src={business.coverUrl} alt="" className="h-40 w-full object-cover sm:h-56" />
      ) : (
        <div aria-hidden="true" className="h-24 w-full bg-ink/5 sm:h-32" />
      )}
      <div className="mx-auto -mt-9 flex max-w-2xl flex-col gap-3 px-4">
        <BusinessAvatar name={business.name} logoUrl={business.logoUrl} className="h-[72px] w-[72px] border-2 border-surface text-2xl" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{business.name}</h1>
          <p className="mt-0.5 text-base text-ink-muted">
            {categoryLabel(business.category, business.categoryOther, labels)}
            {business.city ? ` · ${business.city}` : ""}
          </p>
        </div>
        {business.description ? <p className="whitespace-pre-line text-base leading-relaxed text-ink">{business.description}</p> : null}
      </div>
    </header>
  );
}

export function ServicesSection({ slug, services }: { slug: string; services: PublicService[] }) {
  return (
    <section aria-labelledby="services-title" className="flex flex-col gap-3">
      <h2 id="services-title" className="text-lg font-semibold text-ink">
        {t.services}
      </h2>
      {services.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-muted">{t.noServices}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/${slug}/reservar?servicio=${s.id}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-paper"
              >
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-ink">{s.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
                    <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                    {t.minutes(s.durationMin)}
                  </span>
                  {s.description ? <span className="mt-1 block text-sm text-ink-muted">{s.description}</span> : null}
                </span>
                {s.priceCents !== null ? (
                  <span className="shrink-0 text-base font-semibold text-ink">
                    {s.priceIsFrom ? `${t.from} ` : ""}
                    {formatMxnShort(s.priceCents)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LocationSection({ business }: { business: PublicBusiness }) {
  const address = [business.address, business.city, business.state].filter(Boolean).join(", ");
  const link = directionsLink(business);
  if (!address && !link) return null;
  const pin = business.lat !== null && business.lng !== null ? { lat: business.lat, lng: business.lng } : business.mapsUrl ? extractCoords(business.mapsUrl) : null;
  return (
    <section aria-labelledby="location-title" className="flex flex-col gap-3">
      <h2 id="location-title" className="text-lg font-semibold text-ink">
        {t.location}
      </h2>
      {address ? (
        <p className="flex items-start gap-2 text-base text-ink">
          <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
          {address}
        </p>
      ) : null}
      {pin ? (
        <iframe
          title={`${t.location}: ${business.name}`}
          src={osmEmbedUrl(pin.lat, pin.lng)}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-48 w-full rounded-lg border border-line"
        />
      ) : null}
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-md border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-paper"
        >
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
          {t.directions}
        </a>
      ) : null}
    </section>
  );
}

const SOCIALS = [
  ["instagramUrl", "Instagram"],
  ["facebookUrl", "Facebook"],
  ["tiktokUrl", "TikTok"],
  ["youtubeUrl", "YouTube"],
  ["twitterUrl", "X"],
  ["linkedinUrl", "LinkedIn"],
] as const;

export function ContactSection({ business }: { business: PublicBusiness }) {
  const socials = SOCIALS.flatMap(([key, label]) => (business[key] ? [{ label, url: business[key] as string }] : []));
  if (!business.whatsapp && !business.phone && socials.length === 0) return null;
  const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-paper";
  return (
    <section aria-labelledby="contact-title" className="flex flex-col gap-3">
      <h2 id="contact-title" className="text-lg font-semibold text-ink">
        {t.contact}
      </h2>
      <div className="flex flex-wrap gap-2">
        {business.whatsapp ? (
          <a href={whatsappLink(business.whatsapp, t.whatsappGreeting(business.name))} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            {t.whatsapp}
          </a>
        ) : null}
        {business.phone ? (
          <a href={telLink(business.phone)} className={linkClass}>
            <Phone aria-hidden="true" className="h-4 w-4" />
            {t.call} {formatMxPhoneForInput(business.phone)}
          </a>
        ) : null}
      </div>
      {socials.length > 0 ? (
        <ul aria-label={t.social} className="flex flex-wrap gap-2">
          {socials.map((s) => (
            <li key={s.label}>
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
