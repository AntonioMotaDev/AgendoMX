import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { availabilityRules, businesses, services, staff, staffServices } from "@/db/schema";
import type { BusinessStepData, ServiceStepData } from "@/lib/validators/onboarding";
import { getFirstService, getPrimaryStaff } from "@/server/queries/business";
import { scheduleToRules, validateSchedule, type ScheduleIssue, type WeeklySchedule } from "@/server/services/schedule";

/**
 * Database writes for owner setup. Plain functions that take `db`, so they can be
 * integration-tested; the server actions in onboarding.ts add auth and validation.
 */

export type WriteResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Business = typeof businesses.$inferSelect;

/**
 * Creates the owner's business (plus its single staff member) or updates it.
 * An advisory lock per owner serializes concurrent calls, so a double tap on
 * "Continuar" can never create two businesses.
 */
export async function saveBusinessProfile(
  db: Db,
  owner: { id: string; name: string },
  data: BusinessStepData,
): Promise<WriteResult<Business>> {
  try {
    const business = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`business:${owner.id}`}))`);

      const [existing] = await tx.select().from(businesses).where(eq(businesses.ownerUserId, owner.id)).limit(1);
      const values = { name: data.name, category: data.category, state: data.state, city: data.city, slug: data.slug };

      if (existing) {
        const [updated] = await tx.update(businesses).set(values).where(eq(businesses.id, existing.id)).returning();
        return updated!;
      }

      const [created] = await tx.insert(businesses).values({ ownerUserId: owner.id, ...values }).returning();
      await tx.insert(staff).values({ businessId: created!.id, name: owner.name });
      return created!;
    });
    return { ok: true, data: business };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slug_taken" };
    throw error;
  }
}

/** Creates or updates the first service and makes sure the owner's staff performs it. */
export async function saveFirstService(db: Db, businessId: string, data: ServiceStepData): Promise<WriteResult<{ serviceId: string }>> {
  return db.transaction(async (tx) => {
    const owner = await getPrimaryStaff(tx, businessId);
    if (!owner) return { ok: false, error: "no_staff" } as const;

    const values = { name: data.name, priceCents: data.price, durationMin: data.durationMin };
    const existing = await getFirstService(tx, businessId);

    let serviceId: string;
    if (existing) {
      await tx.update(services).set(values).where(and(eq(services.id, existing.id), eq(services.businessId, businessId)));
      serviceId = existing.id;
    } else {
      const [created] = await tx.insert(services).values({ businessId, ...values }).returning({ id: services.id });
      serviceId = created!.id;
    }

    await tx.insert(staffServices).values({ staffId: owner.id, serviceId }).onConflictDoNothing();
    return { ok: true, data: { serviceId } } as const;
  });
}

export type ScheduleWriteError = "no_staff" | "invalid_schedule" | "no_service";

/**
 * Replaces the weekly schedule. With `complete`, also marks onboarding as done
 * (requires an active service), which publishes the business for booking.
 */
export async function saveWeeklySchedule(
  db: Db,
  businessId: string,
  schedule: WeeklySchedule,
  options: { complete: boolean },
): Promise<{ ok: true } | { ok: false; error: ScheduleWriteError; issues?: ScheduleIssue[] }> {
  const issues = validateSchedule(schedule);
  if (issues.length > 0) return { ok: false, error: "invalid_schedule", issues };

  return db.transaction(async (tx) => {
    const owner = await getPrimaryStaff(tx, businessId);
    if (!owner) return { ok: false, error: "no_staff" } as const;

    if (options.complete) {
      const service = await getFirstService(tx, businessId);
      if (!service || !service.isActive) return { ok: false, error: "no_service" } as const;
    }

    await tx.delete(availabilityRules).where(eq(availabilityRules.staffId, owner.id));
    await tx.insert(availabilityRules).values(scheduleToRules(schedule).map((rule) => ({ staffId: owner.id, ...rule })));

    if (options.complete) {
      await tx
        .update(businesses)
        .set({ onboardingCompletedAt: sql`COALESCE(${businesses.onboardingCompletedAt}, now())` })
        .where(eq(businesses.id, businessId));
    }
    return { ok: true } as const;
  });
}
