import { MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelPanel } from "@/components/booking/cancel-panel";
import { Alert } from "@/components/ui/alert";
import { Logo } from "@/components/ui/logo";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { formatInstantDateTime } from "@/lib/dates";
import { legalPublished } from "@/lib/legal";
import { formatMxnShort } from "@/lib/money";
import { formatMxPhoneForInput } from "@/lib/phone";
import { telLink, whatsappLink } from "@/lib/public-links";
import { getAppointmentByToken } from "@/server/queries/public";
import { cancellationDeadline, checkClientCancellation, isSensitiveCategory } from "@/server/services/booking";

const t = copy.public.appointment;

// The token is the only credential: keep the page out of search results and never leak it through Referer.
export const metadata: Metadata = { title: `${t.title} — AgendoMX`, robots: { index: false, follow: false }, referrer: "no-referrer" };

const statusTone = {
  confirmed: "text-success",
  pending: "text-ink",
  completed: "text-ink-muted",
  cancelled: "text-danger",
  no_show: "text-danger",
  rejected: "text-danger",
  expired: "text-ink-muted",
} as const;

export default async function AppointmentPage({ params, searchParams }: PageProps<"/cita/[token]">) {
  const { token } = await params;
  const query = await searchParams;
  const appointment = await getAppointmentByToken(await getDb(), token);
  if (!appointment) notFound();

  const { business: b } = appointment;
  const now = new Date();
  const cancel = checkClientCancellation({ status: appointment.status, startsAt: appointment.startsAt, now, cancellationMinHours: b.cancellationMinHours });
  const active = appointment.status === "pending" || appointment.status === "confirmed";
  const justBooked = query.nueva === "1" && active;
  const location = [b.address, b.city].filter(Boolean).join(", ");
  // Health categories keep the service out of anything that may be shared or shoulder-surfed; here the client sees their own booking.
  const sensitive = isSensitiveCategory(b.category);
  const linkClass = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-5 text-base font-semibold text-ink hover:bg-paper";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
      <Logo className="text-xl" />

      {justBooked ? (
        <Alert tone="success">
          <p className="text-base font-semibold">{appointment.status === "pending" ? copy.public.done.pendingTitle : copy.public.done.confirmedTitle}</p>
          <p className="mt-1">{appointment.status === "pending" ? copy.public.done.pendingBody : copy.public.done.saveLink}</p>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{b.name}</h1>
        <p className={`text-base font-semibold ${statusTone[appointment.status]}`}>{t.status[appointment.status]}</p>
      </div>

      <dl className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <dt className="text-sm text-ink-muted">{t.when}</dt>
          <dd className="text-base font-semibold text-ink">{formatInstantDateTime(appointment.startsAt, b.timezone)}</dd>
        </div>
        {!sensitive ? (
          <div>
            <dt className="text-sm text-ink-muted">{t.what}</dt>
            <dd className="text-base text-ink">{appointment.serviceName}</dd>
          </div>
        ) : null}
        {appointment.priceCents !== null && !sensitive ? (
          <div>
            <dt className="text-sm text-ink-muted">{t.price}</dt>
            <dd className="text-base text-ink">{formatMxnShort(appointment.priceCents)}</dd>
          </div>
        ) : null}
        {location ? (
          <div>
            <dt className="text-sm text-ink-muted">{t.where}</dt>
            <dd className="text-base text-ink">{location}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-sm text-ink-muted">{t.who}</dt>
          <dd className="text-base text-ink">{appointment.clientName}</dd>
        </div>
      </dl>

      {cancel.ok ? (
        <CancelPanel token={token} deadlineLabel={formatInstantDateTime(cancellationDeadline(appointment.startsAt, b.cancellationMinHours), b.timezone)} />
      ) : active && cancel.reason === "too_late" ? (
        <div className="flex flex-col gap-3">
          <Alert tone="info">{t.tooLate(b.cancellationMinHours)}</Alert>
          {b.whatsapp ? (
            <a href={whatsappLink(b.whatsapp, t.whatsappCancelled(b.name))} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <MessageCircle aria-hidden="true" className="h-5 w-5" />
              {t.contactWhatsApp}
            </a>
          ) : null}
          {b.phone ? (
            <a href={telLink(b.phone)} className={linkClass}>
              <Phone aria-hidden="true" className="h-5 w-5" />
              {t.contactPhone} · {formatMxPhoneForInput(b.phone)}
            </a>
          ) : null}
        </div>
      ) : appointment.status === "cancelled" ? (
        <Alert tone="info">{t.cancelled}</Alert>
      ) : null}

      {b.cancellationPolicyText ? <p className="whitespace-pre-line text-sm text-ink-muted">{b.cancellationPolicyText}</p> : null}

      <Link href={`/${b.slug}`} className="text-center text-sm font-semibold text-brand-ink underline underline-offset-4">
        {copy.public.done.back}
      </Link>
      {legalPublished() ? (
        <Link href={`/${b.slug}/privacidad`} className="text-center text-xs text-ink-muted underline underline-offset-2">
          {copy.public.profile.privacyLink}
        </Link>
      ) : null}
    </main>
  );
}
