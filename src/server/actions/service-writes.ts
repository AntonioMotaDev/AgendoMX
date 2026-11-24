import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { appointments, services, staff, staffServices } from "@/db/schema";
import type { ServiceFormData } from "@/lib/validators/services";
import type { WriteResult } from "./business-writes";

export type ServiceWriteError = "not_found" | "last_active" | "has_appointments";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Serializes service changes per business so the "at least one active service" rule cannot race. */
async function lockServices(tx: Tx, businessId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`services:${businessId}`}))`);
}

async function otherActiveCount(tx: Tx, businessId: string, excludeServiceId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(services)
    .where(and(eq(services.businessId, businessId), eq(services.isActive, true), ne(services.id, excludeServiceId)));
  return row?.n ?? 0;
}

const values = (data: ServiceFormData) => ({
  name: data.name,
  description: data.description,
  priceCents: data.price,
  priceIsFrom: data.priceIsFrom,
  durationMin: data.durationMin,
  bufferAfterMin: data.bufferAfterMin,
  isBookableOnline: data.isBookableOnline,
  isActive: data.isActive,
});

/** Adds a service at the end of the list and lets every active staff member perform it. */
export async function createService(db: Db, businessId: string, data: ServiceFormData): Promise<WriteResult<{ id: string }>> {
  return db.transaction(async (tx) => {
    await lockServices(tx, businessId);
    const [last] = await tx
      .select({ sortOrder: services.sortOrder })
      .from(services)
      .where(eq(services.businessId, businessId))
      .orderBy(sql`${services.sortOrder} DESC`)
      .limit(1);
    const [created] = await tx
      .insert(services)
      .values({ businessId, ...values(data), sortOrder: (last?.sortOrder ?? -1) + 1 })
      .returning({ id: services.id });

    const team = await tx.select({ id: staff.id }).from(staff).where(and(eq(staff.businessId, businessId), eq(staff.isActive, true)));
    if (team.length > 0) {
      await tx.insert(staffServices).values(team.map((member) => ({ staffId: member.id, serviceId: created!.id }))).onConflictDoNothing();
    }
    return { ok: true, data: { id: created!.id } } as const;
  });
}

export async function updateService(
  db: Db,
  businessId: string,
  serviceId: string,
  data: ServiceFormData,
): Promise<WriteResult<{ id: string }> | { ok: false; error: ServiceWriteError }> {
  return db.transaction(async (tx) => {
    await lockServices(tx, businessId);
    const [existing] = await tx
      .select({ isActive: services.isActive })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.businessId, businessId)))
      .limit(1);
    if (!existing) return { ok: false, error: "not_found" } as const;
    if (existing.isActive && !data.isActive && (await otherActiveCount(tx, businessId, serviceId)) === 0) {
      return { ok: false, error: "last_active" } as const;
    }
    await tx.update(services).set(values(data)).where(and(eq(services.id, serviceId), eq(services.businessId, businessId)));
    return { ok: true, data: { id: serviceId } } as const;
  });
}

/** Deletes a service nobody has booked. Services with history can only be hidden. */
export async function deleteService(db: Db, businessId: string, serviceId: string): Promise<{ ok: true } | { ok: false; error: ServiceWriteError }> {
  return db.transaction(async (tx) => {
    await lockServices(tx, businessId);
    const [existing] = await tx
      .select({ isActive: services.isActive })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.businessId, businessId)))
      .limit(1);
    if (!existing) return { ok: false, error: "not_found" } as const;
    if (existing.isActive && (await otherActiveCount(tx, businessId, serviceId)) === 0) return { ok: false, error: "last_active" } as const;

    const [booked] = await tx.select({ n: count() }).from(appointments).where(eq(appointments.serviceId, serviceId));
    if ((booked?.n ?? 0) > 0) return { ok: false, error: "has_appointments" } as const;

    await tx.delete(services).where(and(eq(services.id, serviceId), eq(services.businessId, businessId)));
    return { ok: true } as const;
  });
}

/** Moves a service one place up or down. Renumbers the whole list so ties never matter. */
export async function moveService(db: Db, businessId: string, serviceId: string, direction: "up" | "down"): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  return db.transaction(async (tx) => {
    await lockServices(tx, businessId);
    const list = await tx
      .select({ id: services.id })
      .from(services)
      .where(eq(services.businessId, businessId))
      .orderBy(asc(services.sortOrder), asc(services.name), asc(services.id));
    const index = list.findIndex((row) => row.id === serviceId);
    if (index === -1) return { ok: false, error: "not_found" } as const;

    const target = direction === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < list.length) [list[index], list[target]] = [list[target]!, list[index]!];
    for (const [position, row] of list.entries()) {
      await tx.update(services).set({ sortOrder: position }).where(and(eq(services.id, row.id), eq(services.businessId, businessId)));
    }
    return { ok: true } as const;
  });
}
