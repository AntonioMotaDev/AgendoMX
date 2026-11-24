"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { getCurrentBusiness, requireOwner } from "@/lib/session";
import { toLocalDate } from "@/lib/time";
import { daysToSchedule, scheduleIssueMessage, scheduleStepSchema } from "@/lib/validators/onboarding";
import { saveWeeklySchedule } from "./business-writes";
import { deleteExceptionDate, saveExceptions } from "./exception-writes";
import { firstIssue, guarded } from "./helpers";
import { fail, ok, type ActionResult } from "./result";

const t = copy.panel.schedule;

async function currentBusiness() {
  await requireOwner();
  return getCurrentBusiness();
}

/** Panel version of the weekly editor: same rules as onboarding, without touching completion. */
export async function saveWeeklyScheduleAction(input: unknown): Promise<ActionResult> {
  const business = await currentBusiness();
  if (!business) return fail(copy.onboarding.guard.incomplete);
  const parsed = scheduleStepSchema.safeParse(input);
  if (!parsed.success) return fail(copy.panel.common.genericError);

  return guarded("saveWeeklySchedule", async () => {
    const result = await saveWeeklySchedule(await getDb(), business.id, daysToSchedule(parsed.data.days), { complete: false });
    if (result.ok) return ok(undefined);
    if (result.error === "invalid_schedule" && result.issues?.[0]) return fail(scheduleIssueMessage(result.issues[0]), "schedule");
    return fail(copy.panel.common.genericError);
  });
}

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t.errors.bad_date);

const exceptionSchema = z.object({
  startDate: dateText,
  endDate: z.union([dateText, z.literal("")]).nullish(),
  kind: z.enum(["closed", "custom_hours"]),
  blocks: z.array(z.object({ start: z.string().max(5), end: z.string().max(5) })).max(6),
});

export async function saveExceptionAction(input: unknown): Promise<ActionResult<{ dates: number }>> {
  const business = await currentBusiness();
  if (!business) return fail(copy.onboarding.guard.incomplete);
  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  return guarded("saveException", async () => {
    // "Today" is the business's calendar date, not the server's.
    const today = toLocalDate(new Date(), business.timezone);
    const result = await saveExceptions(await getDb(), business.id, { ...parsed.data, endDate: parsed.data.endDate || null }, today);
    if (result.ok) return ok(result.data);
    if (result.error === "invalid") return fail(t.errors[result.issues[0] ?? "bad_date"]);
    return fail(copy.panel.common.genericError);
  });
}

export async function deleteExceptionAction(date: string): Promise<ActionResult> {
  const business = await currentBusiness();
  if (!business) return fail(copy.onboarding.guard.incomplete);
  if (!dateText.safeParse(date).success) return fail(t.errors.bad_date);

  return guarded("deleteException", async () => {
    const result = await deleteExceptionDate(await getDb(), business.id, date);
    return result.ok ? ok(undefined) : fail(copy.panel.common.genericError);
  });
}
