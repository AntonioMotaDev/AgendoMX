"use server";

import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { legalSwitches } from "@/lib/legal";
import { getCurrentBusiness, requireOwner } from "@/lib/session";
import {
  businessStepSchema,
  daysToSchedule,
  scheduleIssueMessage,
  scheduleStepSchema,
  serviceStepSchema,
  slugSchema,
} from "@/lib/validators/onboarding";
import { isSlugAvailable } from "@/server/queries/business";
import { selectableCategories } from "@/server/services/booking";
import { saveBusinessProfile, saveFirstService, saveWeeklySchedule } from "./business-writes";
import { firstIssue, guarded } from "./helpers";
import { fail, ok, type ActionResult } from "./result";

const c = copy.onboarding;

export type SlugStatus = { state: "available" } | { state: "taken" } | { state: "invalid"; message: string };

/** Live check while typing the slug. The owner's own current slug counts as available. */
export async function checkSlugAction(slug: string): Promise<ActionResult<SlugStatus>> {
  await requireOwner();
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return ok({ state: "invalid", message: parsed.error.issues[0]?.message ?? c.business.slugFormat });

  return guarded("checkSlug", async () => {
    const business = await getCurrentBusiness();
    const available = await isSlugAvailable(await getDb(), parsed.data, business?.id);
    return ok<SlugStatus>(available ? { state: "available" } : { state: "taken" });
  });
}

export async function saveBusinessStepAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const owner = await requireOwner();
  const parsed = businessStepSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  return guarded("saveBusinessStep", async () => {
    // Health categories are not admitted yet (while the legal texts are published): refuse them here, not only in the form.
    const current = await getCurrentBusiness();
    if (!selectableCategories(legalSwitches(), current?.category ?? null).includes(parsed.data.category)) return fail(c.validation.categoryUnavailable, "category");
    const result = await saveBusinessProfile(await getDb(), { id: owner.id, name: owner.name }, parsed.data);
    if (!result.ok) return fail(c.business.slugTaken, "slug");
    return ok({ slug: result.data.slug });
  });
}

export async function saveServiceStepAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = serviceStepSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  return guarded("saveServiceStep", async () => {
    // businessId comes from the session, never from the request.
    const business = await getCurrentBusiness();
    if (!business) return fail(c.guard.incomplete);
    const result = await saveFirstService(await getDb(), business.id, parsed.data);
    return result.ok ? ok(undefined) : fail(c.shell.savingError);
  });
}

export async function saveScheduleStepAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = scheduleStepSchema.safeParse(input);
  if (!parsed.success) return fail(c.shell.savingError);

  return guarded("saveScheduleStep", async () => {
    const business = await getCurrentBusiness();
    if (!business) return fail(c.guard.incomplete);
    const result = await saveWeeklySchedule(await getDb(), business.id, daysToSchedule(parsed.data.days), { complete: true });
    if (result.ok) return ok(undefined);
    if (result.error === "invalid_schedule" && result.issues?.[0]) return fail(scheduleIssueMessage(result.issues[0]), "schedule");
    return fail(result.error === "no_service" ? c.guard.incomplete : c.shell.savingError);
  });
}
