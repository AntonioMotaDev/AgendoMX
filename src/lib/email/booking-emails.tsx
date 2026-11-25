import "server-only";
import { copy } from "@/lib/copy";
import { formatInstantDateTime } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { isSensitiveCategory } from "@/server/services/booking";
import type { BusinessCategory } from "@/lib/categories";
import { BookingEmail, type BookingEmailProps } from "./templates/booking-email";
import { sendEmail } from "./send";

const c = copy.public.email;

interface Rows {
  rows: BookingEmailProps["details"];
}

function plain(greeting: string, body: string, { rows }: Rows, cta: string, url: string, note?: string): string {
  return [greeting, "", body, "", ...rows.map((r) => `${r.label}: ${r.value}`), "", `${cta}: ${url}`, ...(note ? ["", note] : []), "", copy.email.footer].join("\n");
}

export interface ClientEmailInput {
  to: string;
  clientName: string;
  token: string;
  status: "confirmed" | "pending";
  startsAt: Date;
  serviceName: string;
  business: { name: string; category: BusinessCategory; timezone: string; address: string | null; city: string | null; cancellationMinHours: number };
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
  return sendEmail({
    to: input.to,
    subject: confirmed ? c.client.confirmedSubject(b.name) : c.client.pendingSubject(b.name),
    text: plain(greeting, body, { rows }, c.client.cta, url, note),
    react: (
      <BookingEmail
        preview={confirmed ? c.client.confirmedPreview : c.client.pendingPreview}
        greeting={greeting}
        body={body}
        details={rows}
        cta={c.client.cta}
        url={url}
        note={note}
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
  return sendEmail({
    to: input.to,
    subject,
    text: plain(greeting, body, { rows }, o.cta, url),
    react: <BookingEmail preview={preview} greeting={greeting} body={body} details={rows} cta={o.cta} url={url} />,
  });
}
