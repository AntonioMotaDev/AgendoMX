import { CalendarDays, CircleCheck, Hourglass, MapPin, MessageCircle, Phone, UserRound, Ban, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelPanel } from "@/components/booking/cancel-panel";
import { Notice } from "@/components/public/notice";
import { tLink } from "@/components/public/styles";
import { ThemeScope } from "@/components/public/theme-scope";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { formatInstantDateTime } from "@/lib/dates";
import { legalPublished } from "@/lib/legal";
import { formatMxnShort } from "@/lib/money";
import { formatMxPhoneForInput } from "@/lib/phone";
import { telLink, whatsappLink } from "@/lib/public-links";
import { cn } from "@/lib/utils";
import { getAppointmentByToken } from "@/server/queries/public";
import { cancellationDeadline, checkClientCancellation, isSensitiveCategory } from "@/server/services/booking";

const t = copy.public.appointment;

// The token is the only credential: keep the page out of search results and never leak it through Referer.
export const metadata: Metadata = { title: `${t.title} — AgendoMX`, robots: { index: false, follow: false }, referrer: "no-referrer" };

const STATUS: Record<string, { tone: "ok" | "wait" | "bad" | "off"; Icon: LucideIcon }> = {
  confirmed: { tone: "ok", Icon: CircleCheck },
  pending: { tone: "wait", Icon: Hourglass },
  completed: { tone: "off", Icon: CircleCheck },
  cancelled: { tone: "bad", Icon: Ban },
  no_show: { tone: "bad", Icon: Ban },
  rejected: { tone: "bad", Icon: Ban },
  expired: { tone: "off", Icon: Hourglass },
};

const TONE = {
  ok: "bg-th-soft text-th-text",
  wait: "bg-th-soft text-th-text",
  off: "bg-th-surface text-th-muted border border-th-line",
  bad: "bg-th-danger/10 text-th-danger",
} as const;

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-th-primary" />
      <div className="min-w-0">
        <dt className="text-[13px] text-th-muted">{label}</dt>
        <dd className="text-base font-semibold text-th-text">{children}</dd>
      </div>
    </div>
  );
}

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
  const status = STATUS[appointment.status] ?? STATUS.expired!;

  return (
    <ThemeScope theme={b.theme}>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6 sm:py-12">
        {justBooked ? (
          <Notice tone="success">
            <p className="text-base font-bold">{appointment.status === "pending" ? copy.public.done.pendingTitle : copy.public.done.confirmedTitle}</p>
            <p className="mt-1">{appointment.status === "pending" ? copy.public.done.pendingBody : copy.public.done.saveLink}</p>
          </Notice>
        ) : null}

        <div className="flex flex-col items-start gap-2">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-th-text">{b.name}</h1>
          <p className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold", TONE[status.tone])}>
            <status.Icon aria-hidden="true" className="h-4 w-4" />
            {t.status[appointment.status]}
          </p>
        </div>

        <dl className="flex flex-col gap-4 rounded-[20px] border border-th-line bg-th-surface p-5">
          <Row icon={CalendarDays} label={t.when}>
            {formatInstantDateTime(appointment.startsAt, b.timezone)}
          </Row>
          {!sensitive ? <Row icon={CircleCheck} label={t.what}>{appointment.serviceName}</Row> : null}
          {appointment.priceCents !== null && !sensitive ? <Row icon={CircleCheck} label={t.price}>{formatMxnShort(appointment.priceCents)}</Row> : null}
          {location ? <Row icon={MapPin} label={t.where}>{location}</Row> : null}
          <Row icon={UserRound} label={t.who}>
            {appointment.clientName}
          </Row>
        </dl>

        {cancel.ok ? (
          <CancelPanel token={token} deadlineLabel={formatInstantDateTime(cancellationDeadline(appointment.startsAt, b.cancellationMinHours), b.timezone)} />
        ) : active && cancel.reason === "too_late" ? (
          <div className="flex flex-col gap-3">
            <Notice tone="info">{t.tooLate(b.cancellationMinHours)}</Notice>
            {b.whatsapp ? (
              <a href={whatsappLink(b.whatsapp, t.whatsappCancelled(b.name))} target="_blank" rel="noopener noreferrer" className={tLink}>
                <MessageCircle aria-hidden="true" className="h-5 w-5" />
                {t.contactWhatsApp}
              </a>
            ) : null}
            {b.phone ? (
              <a href={telLink(b.phone)} className={tLink}>
                <Phone aria-hidden="true" className="h-5 w-5" />
                {t.contactPhone} · {formatMxPhoneForInput(b.phone)}
              </a>
            ) : null}
          </div>
        ) : appointment.status === "cancelled" ? (
          <Notice tone="info">{t.cancelled}</Notice>
        ) : null}

        {b.cancellationPolicyText ? <p className="whitespace-pre-line text-sm text-th-muted">{b.cancellationPolicyText}</p> : null}

        <Link href={`/${b.slug}`} className="text-center text-sm font-bold text-th-text underline underline-offset-4">
          {copy.public.done.back}
        </Link>
        <footer className="mt-2 flex flex-col items-center gap-1 text-center text-xs text-th-muted">
          {legalPublished() ? (
            <Link href={`/${b.slug}/privacidad`} className="underline underline-offset-2">
              {copy.public.profile.privacyLink}
            </Link>
          ) : null}
          {copy.public.profile.powered}
        </footer>
      </main>
    </ThemeScope>
  );
}
