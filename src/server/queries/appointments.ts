import { and, asc, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { appointments, businesses, clients } from "@/db/schema";
import { isUuid } from "@/lib/ids";
import type { AppointmentStatus } from "@/server/services/appointment-status";
import type { Reader } from "./business";

/**
 * Owner-side appointment reads. Every query takes the businessId that came from
 * the session and filters by it: a foreign appointment id is simply not found.
 */

export interface AgendaItem {
  id: string;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  priceCents: number | null;
  clientName: string;
  clientPhone: string;
}

const agendaColumns = {
  id: appointments.id,
  status: appointments.status,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  serviceName: appointments.serviceNameSnapshot,
  priceCents: appointments.priceCentsSnapshot,
  clientName: clients.name,
  clientPhone: clients.phone,
};

/** Appointments that start in [from, to): the ones still alive plus the ones already closed out (completed / no-show). Cancelled, rejected and expired are not agenda. */
export async function listAgenda(db: Reader, businessId: string, from: Date, to: Date): Promise<AgendaItem[]> {
  return db
    .select(agendaColumns)
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.businessId, businessId),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
        inArray(appointments.status, ["pending", "confirmed", "completed", "no_show"]),
      ),
    )
    .orderBy(asc(appointments.startsAt), asc(appointments.id));
}

/** Requests waiting for an answer, soonest first. They need action whatever day they are on. */
export async function listPendingRequests(db: Reader, businessId: string, now: Date): Promise<AgendaItem[]> {
  return db
    .select(agendaColumns)
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(eq(appointments.businessId, businessId), eq(appointments.status, "pending"), gt(appointments.startsAt, now)))
    .orderBy(asc(appointments.startsAt), asc(appointments.id));
}

export interface OwnerAppointmentDetail {
  id: string;
  status: AppointmentStatus;
  startsAt: Date;
  serviceName: string;
  publicToken: string;
  clientName: string;
  clientEmail: string | null;
  business: {
    slug: string;
    name: string;
    category: typeof businesses.$inferSelect["category"];
    timezone: string;
    address: string | null;
    city: string | null;
    cancellationMinHours: number;
  };
}

/** One appointment of this business, with what the notification emails need. Includes the client's email: server-side use only. */
export async function getOwnerAppointment(db: Reader, businessId: string, appointmentId: unknown): Promise<OwnerAppointmentDetail | null> {
  if (!isUuid(appointmentId)) return null;
  const [row] = await db
    .select({ a: appointments, c: clients, b: businesses })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.businessId, businessId)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.a.id,
    status: row.a.status,
    startsAt: row.a.startsAt,
    serviceName: row.a.serviceNameSnapshot,
    publicToken: row.a.publicToken,
    clientName: row.c.name,
    clientEmail: row.c.email,
    business: {
      slug: row.b.slug,
      name: row.b.name,
      category: row.b.category,
      timezone: row.b.timezone,
      address: row.b.address,
      city: row.b.city,
      cancellationMinHours: row.b.cancellationMinHours,
    },
  };
}
