import { and, asc, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { availabilityRules, businesses, services, staff } from "@/db/schema";

/** Anything that can run a select: the db itself or a transaction. */
export type Reader = Pick<Db, "select">;

/**
 * Every query here is scoped by an explicit businessId. Callers get that id from
 * the session (getCurrentBusiness), never from params or the request body.
 */

export async function getPrimaryStaff(db: Reader, businessId: string) {
  const [row] = await db.select().from(staff).where(eq(staff.businessId, businessId)).orderBy(asc(staff.id)).limit(1);
  return row ?? null;
}

/** The service created during onboarding: the first by sort order. */
export async function getFirstService(db: Reader, businessId: string) {
  const [row] = await db
    .select()
    .from(services)
    .where(eq(services.businessId, businessId))
    .orderBy(asc(services.sortOrder), asc(services.id))
    .limit(1);
  return row ?? null;
}

export async function getScheduleRules(db: Reader, staffId: string) {
  return db
    .select({ weekday: availabilityRules.weekday, startTime: availabilityRules.startTime, endTime: availabilityRules.endTime })
    .from(availabilityRules)
    .where(eq(availabilityRules.staffId, staffId))
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));
}

export interface OnboardingState {
  hasBusiness: boolean;
  hasService: boolean;
  hasSchedule: boolean;
  completed: boolean;
}

/** What the owner has done so far. Drives which onboarding step to show. */
export async function getOnboardingState(db: Reader, ownerUserId: string): Promise<OnboardingState & { businessId: string | null }> {
  const [business] = await db.select().from(businesses).where(eq(businesses.ownerUserId, ownerUserId)).limit(1);
  if (!business) return { businessId: null, hasBusiness: false, hasService: false, hasSchedule: false, completed: false };

  const service = await getFirstService(db, business.id);
  const owner = await getPrimaryStaff(db, business.id);
  const rules = owner ? await getScheduleRules(db, owner.id) : [];
  return {
    businessId: business.id,
    hasBusiness: true,
    hasService: service !== null,
    hasSchedule: rules.length > 0,
    completed: business.onboardingCompletedAt !== null,
  };
}

/** True when no other business uses the slug. Pass the caller's own id to allow keeping it. */
export async function isSlugAvailable(db: Reader, slug: string, excludeBusinessId?: string): Promise<boolean> {
  const condition = excludeBusinessId
    ? and(eq(businesses.slug, slug), ne(businesses.id, excludeBusinessId))
    : eq(businesses.slug, slug);
  const [row] = await db.select({ id: businesses.id }).from(businesses).where(condition).limit(1);
  return row === undefined;
}
