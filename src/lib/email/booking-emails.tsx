import "server-only";
import { copy } from "@/lib/copy";
import { formatInstantDateTime } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { legalPublished } from "@/lib/legal";
import { isSensitiveCategory } from "@/server/services/booking";
import type { BusinessCategory } from "@/lib/categories";
import { BookingEmail, type BookingEmailProps } from "./templates/booking-email";
import { sendEmail } from "./send";

const c = copy.public.email;

interface Rows {
  rows: BookingEmailProps["details"];
}

/**
 * Link to the privacy notice for the footer: the business's own notice for clients (the business is
 * the controller), the owners' notice for the owner. Only while the legal pages are published (they 404 otherwise).
 */
function privacyUrlFor(audience: { client: string } | "owner"): string | undefined {
  if (!legalPublished()) return undefined;
  return audience === "owner" ? `${appUrl()}/privacidad` : `${appUrl()}/${audience.client}/privacidad`;
}

function plain(greeting: string, body: string, { rows }: Rows, cta: string, url: string, note?: string, privacyUrl?: string): string {
  return [
    greeting,
    "",
    body,
    "",
    ...rows.map((r) => `${r.label}: ${r.value}`),
    "",
    `${cta}: ${url}`,
    ...(note ? ["", note] : []),
    "",
    copy.email.footer,
    ...(privacyUrl ? [`${copy.email.privacyNotice}: ${privacyUrl}`] : []),
  ].join("\n");
}

export interface ClientEmailInput {
  to: string;
  clientName: string;
  token: string;
  status: "confirmed" | "pending";
  startsAt: Date;
  serviceName: string;
  business: { name: string; slug: string; category: BusinessCategory; timezone: string; address: string | null; city: string | null; cancellationMinHours: number };
}

/**
 * Confirmation (or "request received") for the client. Health categories never
 * name the service: merely having an appointment can be sensitive (CLAUDE.md §6).
 */
export function sendClientBookingEmail(input: ClientEmailInput) {
  const { business: b } = input;
  const confirmed = input.status === "confirmed";
  const url = `${appUrl()}/cita/${input.token}`;
  const location = [b.address, b.city].filter(Boolean).join(", ");
  const rows: BookingEmailProps["details"] = [
    { label: c.client.when, value: formatInstantDateTime(input.startsAt, b.timezone) },
    ...(isSensitiveCategory(b.category) ? [] : [{ label: c.client.service, value: input.serviceName }]),
    ...(location ? [{ label: c.client.where, value: location }] : []),
  ];
  const greeting = c.client.greeting(input.clientName.trim().split(/\s+/)[0] || input.clientName);
  const body = confirmed ? c.client.confirmedBody(b.name) : c.client.pendingBody(b.name);
  const note = `${c.client.cancelHint(b.cancellationMinHours)} ${c.client.ignore}`;
  const privacyUrl = privacyUrlFor({ client: b.slug });
  return sendEmail({
    to: input.to,
    subject: confirmed ? c.client.confirmedSubject(b.name) : c.client.pendingSubject(b.name),
    text: plain(greeting, body, { rows }, c.client.cta, url, note, privacyUrl),
    react: (
      <BookingEmail
        preview={confirmed ? c.client.confirmedPreview : c.client.pendingPreview}
        greeting={greeting}
        body={body}
        details={rows}
        cta={c.client.cta}
        url={url}
        note={note}
        privacyUrl={privacyUrl}
      />
    ),
  });
}

export interface OwnerEmailInput {
  to: string;
  ownerName: string;
  kind: "new" | "request" | "cancelled";
  clientName: string;
  clientPhone: string | null;
  startsAt: Date;
  serviceName: string;
  timezone: string;
}

/** Notice to the owner's account email. The owner is the data controller, so the service name is fine here. */
export function sendOwnerBookingEmail(input: OwnerEmailInput) {
  const o = c.owner;
  const when = formatInstantDateTime(input.startsAt, input.timezone);
  const url = `${appUrl()}/app`;
  const rows: BookingEmailProps["details"] = [
    { label: o.client, value: input.clientName },
    ...(input.clientPhone ? [{ label: o.phone, value: input.clientPhone }] : []),
    { label: o.when, value: when },
    { label: o.service, value: input.serviceName },
  ];
  const greeting = o.greeting(input.ownerName.trim().split(/\s+/)[0] || input.ownerName);
  const subject = input.kind === "new" ? o.newSubject(when) : input.kind === "request" ? o.requestSubject(when) : o.cancelledSubject(when);
  const preview = input.kind === "new" ? o.newPreview : input.kind === "request" ? o.requestPreview : o.cancelledPreview;
  const body = input.kind === "new" ? o.newBody : input.kind === "request" ? o.requestBody : o.cancelledBody;
  const privacyUrl = privacyUrlFor("owner");
  return sendEmail({
    to: input.to,
    subject,
    text: plain(greeting, body, { rows }, o.cta, url, undefined, privacyUrl),
    react: <BookingEmail preview={preview} greeting={greeting} body={body} details={rows} cta={o.cta} url={url} privacyUrl={privacyUrl} />,
  });
}

export interface ClientStatusEmailInput {
  to: string;
  clientName: string;
  kind: "rejected" | "cancelled";
  startsAt: Date;
  serviceName: string;
  business: { name: string; slug: string; category: BusinessCategory; timezone: string };
}

/** Tells the client the business rejected their request or cancelled their appointment, with a link to pick another time. */
export function sendClientStatusEmail(input: ClientStatusEmailInput) {
  const s = c.clientStatus;
  const { business: b } = input;
  const url = `${appUrl()}/${b.slug}`;
  const rows: BookingEmailProps["details"] = [
    { label: c.client.when, value: formatInstantDateTime(input.startsAt, b.timezone) },
    ...(isSensitiveCategory(b.category) ? [] : [{ label: c.client.service, value: input.serviceName }]),
  ];
  const greeting = c.client.greeting(input.clientName.trim().split(/\s+/)[0] || input.clientName);
  const rejected = input.kind === "rejected";
  const body = rejected ? s.rejectedBody(b.name) : s.cancelledBody(b.name);
  const privacyUrl = privacyUrlFor({ client: b.slug });
  return sendEmail({
    to: input.to,
    subject: rejected ? s.rejectedSubject(b.name) : s.cancelledSubject(b.name),
    text: plain(greeting, body, { rows }, s.cta, url, undefined, privacyUrl),
    react: <BookingEmail preview={rejected ? s.rejectedPreview : s.cancelledPreview} greeting={greeting} body={body} details={rows} cta={s.cta} url={url} privacyUrl={privacyUrl} />,
  });
}

export interface ReminderEmailInput {
  to: string;
  clientName: string;
  token: string;
  startsAt: Date;
  serviceName: string;
  business: { name: string; slug: string; category: BusinessCategory; timezone: string; address: string | null; city: string | null; cancellationMinHours: number };
}

/** 24 h reminder. Health categories never name the service (CLAUDE.md §6). */
export function sendReminderEmail(input: ReminderEmailInput) {
  const r = c.reminder;
  const { business: b } = input;
  const url = `${appUrl()}/cita/${input.token}`;
  const location = [b.address, b.city].filter(Boolean).join(", ");
  const rows: BookingEmailProps["details"] = [
    { label: c.client.when, value: formatInstantDateTime(input.startsAt, b.timezone) },
    ...(isSensitiveCategory(b.category) ? [] : [{ label: c.client.service, value: input.serviceName }]),
    ...(location ? [{ label: c.client.where, value: location }] : []),
  ];
  const greeting = c.client.greeting(input.clientName.trim().split(/\s+/)[0] || input.clientName);
  const body = r.body(b.name);
  const note = c.client.cancelHint(b.cancellationMinHours);
  const privacyUrl = privacyUrlFor({ client: b.slug });
  return sendEmail({
    to: input.to,
    subject: r.subject(b.name),
    text: plain(greeting, body, { rows }, r.cta, url, note, privacyUrl),
    react: <BookingEmail preview={r.preview} greeting={greeting} body={body} details={rows} cta={r.cta} url={url} note={note} privacyUrl={privacyUrl} />,
  });
}
