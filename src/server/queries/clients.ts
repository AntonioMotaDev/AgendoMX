import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { appointments, clients } from "@/db/schema";
import type { Reader } from "./business";

export interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  appointments: number;
  lastAppointmentAt: Date | null;
  /** Pending or confirmed appointments still ahead: while any exist the client's data cannot be erased. */
  upcoming: number;
}

/**
 * The business's customers, most recent first. People whose data was erased are left out:
 * there is nothing left to show or act on. Always scoped by businessId (from the session).
 */
export async function listClients(db: Reader, businessId: string, now: Date, limit = 500): Promise<ClientRow[]> {
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      email: clients.email,
      appointments: sql<number>`count(${appointments.id})::int`,
      lastAppointmentAt: sql<Date | null>`max(${appointments.startsAt})`,
      upcoming: sql<number>`count(${appointments.id}) filter (where ${appointments.status} in ('pending','confirmed') and ${appointments.startsAt} > ${now.toISOString()}::timestamptz)::int`,
    })
    .from(clients)
    .leftJoin(appointments, eq(appointments.clientId, clients.id))
    .where(and(eq(clients.businessId, businessId), isNull(clients.anonymizedAt)))
    .groupBy(clients.id)
    // Newest activity first; people without appointments last (Postgres puts NULLs first on DESC).
    .orderBy(sql`max(${appointments.startsAt}) desc nulls last`, clients.name)
    .limit(limit);
  return rows.map((r) => ({ ...r, lastAppointmentAt: r.lastAppointmentAt ? new Date(r.lastAppointmentAt) : null }));
}

/** Counts of pending/confirmed future appointments for one client of this business. */
export async function countUpcomingForClient(db: Reader, businessId: string, clientId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(eq(appointments.businessId, businessId), eq(appointments.clientId, clientId), inArray(appointments.status, ["pending", "confirmed"]), gt(appointments.startsAt, now)));
  return row?.n ?? 0;
}
