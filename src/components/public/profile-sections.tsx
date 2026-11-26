import { Clock, ExternalLink, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { categoryLabel } from "@/lib/categories";
import { copy } from "@/lib/copy";
import { extractCoords } from "@/lib/maps";
import { formatMxnShort } from "@/lib/money";
import { formatMxPhoneForInput } from "@/lib/phone";
import { directionsLink, osmEmbedUrl, telLink, whatsappLink } from "@/lib/public-links";
import { cn } from "@/lib/utils";
import type { PublicBusiness, PublicHoursDay, PublicService } from "@/server/queries/public";
import { CoverArt } from "./cover-art";

const t = copy.public.profile;
const labels = copy.onboarding.categories;

/** The business logo, or its initial on the theme's primary color. */
export function ThemedAvatar({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "•";
  const base = "relative flex shrink-0 items-center justify-center rounded-full border-4 border-th-bg";
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- served by our own /media route, already compressed
    <img src={logoUrl} alt="" className={cn(base, "object-cover", className)} />
  ) : (
    <span aria-hidden="true" className={cn(base, "bg-th-primary font-extrabold text-th-onp", className)}>
      {initial}
    </span>
  );
}

/** Cover photo, or the theme's pattern while the business has none. */
export function ProfileCover({ business }: { business: PublicBusiness }) {
  return (
    <div className="h-[150px] overflow-hidden sm:h-[190px] sm:rounded-[26px] lg:h-[230px]">
      {business.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own /media route, already compressed
        <img src={business.coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <CoverArt theme={business.theme} />
      )}
    </div>
  );
}

export function ProfileIdentity({ business }: { business: PublicBusiness }) {
  return (
    <>
      <ThemedAvatar
        name={business.name}
        logoUrl={business.logoUrl}
        className="-mt-[42px] h-[84px] w-[84px] text-[34px] lg:-mt-12 lg:h-24 lg:w-24 lg:text-[38px]"
      />
      <div>
        <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight text-th-text">{business.name}</h1>
        <p className="mt-1 text-sm text-th-muted">
          {categoryLabel(business.category, business.categoryOther, labels)}
          {business.city ? ` · ${business.city}` : ""}
        </p>
      </div>
      {business.description ? <p className="max-w-[60ch] whitespace-pre-line text-[15px] leading-relaxed text-th-text">{business.description}</p> : null}
    </>
  );
}

const actionClass =
  "flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-th-line bg-th-surface px-1 py-1.5 text-center text-xs font-semibold text-th-text hover:bg-th-soft";

/** WhatsApp, call, directions and Instagram, only the ones the business has. */
export function QuickActions({ business }: { business: PublicBusiness }) {
  const directions = directionsLink(business);
  const items: Array<{ key: string; label: string; href: string; icon: ReactNode; external: boolean }> = [];
  if (business.whatsapp) items.push({ key: "wa", label: t.whatsapp, href: whatsappLink(business.whatsapp, t.whatsappGreeting(business.name)), icon: <MessageCircle aria-hidden="true" className="h-[22px] w-[22px] text-th-primary" />, external: true });
  if (business.phone) items.push({ key: "tel", label: t.call, href: telLink(business.phone), icon: <Phone aria-hidden="true" className="h-[22px] w-[22px] text-th-primary" />, external: false });
  if (directions) items.push({ key: "dir", label: t.directions, href: directions, icon: <Navigation aria-hidden="true" className="h-[22px] w-[22px] text-th-primary" />, external: true });
  if (business.instagramUrl) items.push({ key: "ig", label: t.instagram, href: business.instagramUrl, icon: <ExternalLink aria-hidden="true" className="h-[22px] w-[22px] text-th-primary" />, external: true });
  if (items.length === 0) return null;
  return (
    <div className="grid max-w-[520px] grid-flow-col auto-cols-fr gap-2">
      {items.map((item) => (
        <a key={item.key} href={item.href} className={actionClass} {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {item.icon}
          {item.label}
        </a>
      ))}
    </div>
  );
}

export function ServicesPanel({ slug, services }: { slug: string; services: PublicService[] }) {
  if (services.length === 0) {
    return <p className="rounded-2xl border border-th-line bg-th-surface p-4 text-sm text-th-muted">{t.noServices}</p>;
  }
  return (
    <ul className="overflow-hidden rounded-[20px] border border-th-line bg-th-surface">
      {services.map((s, i) => (
        <li key={s.id} className={cn(i > 0 && "border-t border-th-line")}>
          <Link href={`/${slug}/reservar?servicio=${s.id}`} className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-th-soft">
            <span className="min-w-0">
              <span className="block text-base font-bold text-th-text">{s.name}</span>
              <span className="mt-0.5 flex items-start gap-1.5 text-[13px] text-th-muted">
                <Clock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {t.minutes(s.durationMin)}
                  {s.description ? ` · ${s.description}` : ""}
                </span>
              </span>
            </span>
            {s.priceCents !== null ? (
              <span className="shrink-0 text-base font-extrabold tabular-nums text-th-text">
                {s.priceIsFrom ? <span className="mr-1 text-xs font-semibold text-th-muted">{t.from}</span> : null}
                {formatMxnShort(s.priceCents)}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const hourFmt = (hhmm: string) => hhmm.replace(/^0/, "");

function HoursList({ hours, todayWeekday }: { hours: PublicHoursDay[]; todayWeekday: number }) {
  return (
    <ul className="rounded-[18px] border border-th-line bg-th-surface px-4 py-1">
      {hours.map((d, i) => {
        const today = d.weekday === todayWeekday;
        return (
          <li key={d.weekday} className={cn("flex min-h-[42px] items-center justify-between gap-3 text-sm tabular-nums", i > 0 && "border-t border-th-line", today ? "font-extrabold text-th-text" : "text-th-muted")}>
            <span className="flex items-center gap-2">
              {t.weekdays[d.weekday]}
              {today ? <span className="rounded-full bg-th-primary px-2 py-px text-[11px] font-bold text-th-onp">{t.today}</span> : null}
            </span>
            <span className="text-right">{d.ranges.length === 0 ? t.closed : d.ranges.map((r) => `${hourFmt(r.start)} – ${hourFmt(r.end)}`).join(", ")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function LocationBlock({ business }: { business: PublicBusiness }) {
  const address = [business.address, business.city, business.state].filter(Boolean).join(", ");
  const link = directionsLink(business);
  if (!address && !link) return null;
  const pin = business.lat !== null && business.lng !== null ? { lat: business.lat, lng: business.lng } : business.mapsUrl ? extractCoords(business.mapsUrl) : null;
  return (
    <section aria-labelledby="location-title" className="flex flex-col gap-2.5">
      <h2 id="location-title" className="text-[17px] font-extrabold text-th-text">
        {t.location}
      </h2>
      <div className="overflow-hidden rounded-[18px] border border-th-line bg-th-soft">
        {pin ? (
          <iframe title={t.mapAlt(business.name)} src={osmEmbedUrl(pin.lat, pin.lng)} loading="lazy" referrerPolicy="no-referrer" className="block h-44 w-full border-0" />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-th-surface px-4 py-3 text-sm">
          {address ? (
            <p className="flex min-w-0 flex-1 items-start gap-2 text-th-text">
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-th-primary" />
              <span>{address}</span>
            </p>
          ) : null}
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-th-line bg-th-surface px-4 text-sm font-bold text-th-text hover:bg-th-soft">
              <Navigation aria-hidden="true" className="h-4 w-4" />
              {t.directions}
            </a>
          ) : null}
        </div>
      </div>
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

function ContactBlock({ business }: { business: PublicBusiness }) {
  const socials = SOCIALS.flatMap(([key, label]) => (business[key] ? [{ label, url: business[key] as string }] : []));
  if (!business.whatsapp && !business.phone && socials.length === 0) return null;
  const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-xl border border-th-line bg-th-surface px-4 text-sm font-bold text-th-text hover:bg-th-soft";
  return (
    <section aria-labelledby="contact-title" className="flex flex-col gap-2.5">
      <h2 id="contact-title" className="text-[17px] font-extrabold text-th-text">
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

/** The "Información" tab: weekly hours, where to find the business, contact and the cancellation policy. */
export function InfoPanel({ business, hours, todayWeekday }: { business: PublicBusiness; hours: PublicHoursDay[]; todayWeekday: number }) {
  const hasHours = hours.some((d) => d.ranges.length > 0);
  return (
    <div className="flex flex-col gap-6">
      {hasHours ? (
        <section aria-labelledby="hours-title" className="flex flex-col gap-2.5">
          <h2 id="hours-title" className="text-[17px] font-extrabold text-th-text">
            {t.hours}
          </h2>
          <HoursList hours={hours} todayWeekday={todayWeekday} />
          <p className="text-xs text-th-muted">{t.hoursNote}</p>
        </section>
      ) : null}
      <LocationBlock business={business} />
      <ContactBlock business={business} />
      <div className="flex flex-col gap-1.5 text-sm text-th-muted">
        <p>{t.cancellation(business.cancellationMinHours)}</p>
        {business.cancellationPolicyText ? <p className="whitespace-pre-line">{business.cancellationPolicyText}</p> : null}
      </div>
    </div>
  );
}

/** Desktop and landscape tablets: the booking call to action stays next to the content. */
export function BookingCard({ slug, cancellationMinHours, city }: { slug: string; cancellationMinHours: number; city: string | null }) {
  return (
    <div className="sticky top-5 grid gap-3.5 rounded-[22px] border border-th-line bg-th-surface p-5">
      <h2 className="text-xl font-extrabold tracking-tight text-th-text">{t.sideTitle}</h2>
      <p className="text-sm text-th-muted">{t.sideBody}</p>
      <ul className="grid gap-2 text-sm text-th-text">
        <li className="flex items-center gap-2.5">
          <Clock aria-hidden="true" className="h-[18px] w-[18px] text-th-primary" />
          {t.sideCancel(cancellationMinHours)}
        </li>
        {city ? (
          <li className="flex items-center gap-2.5">
            <MapPin aria-hidden="true" className="h-[18px] w-[18px] text-th-primary" />
            {city}
          </li>
        ) : null}
      </ul>
      <Link href={`/${slug}/reservar`} className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-th-primary px-5 text-base font-bold text-th-onp hover:brightness-110">
        {t.book}
      </Link>
      <p className="text-center text-xs text-th-muted">{t.sideNoAccount}</p>
    </div>
  );
}

/** Phones and portrait tablets: a fixed bar with the booking button. */
export function BookBar({ slug }: { slug: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-th-line bg-th-bg/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-2xl sm:justify-end">
        <Link
          href={`/${slug}/reservar`}
          className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-th-primary px-6 text-base font-bold text-th-onp hover:brightness-110 sm:w-60"
        >
          {t.book}
        </Link>
      </div>
    </div>
  );
}
