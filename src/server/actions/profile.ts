"use server";

import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { getCurrentBusiness, requireOwner } from "@/lib/session";
import { bookingSettingsSchema, profileInfoSchema, slugChangeSchema, socialLinksSchema } from "@/lib/validators/profile";
import { firstIssue, guarded } from "./helpers";
import { changeSlug, updateBookingSettings, updateProfileInfo, updateSocialLinks } from "./profile-writes";
import { fail, ok, type ActionResult } from "./result";

async function currentBusiness() {
  await requireOwner();
  return getCurrentBusiness();
}

export async function saveProfileInfoAction(input: unknown): Promise<ActionResult> {
  const business = await currentBusiness();
  if (!business) return fail(copy.onboarding.guard.incomplete);
  const parsed = profileInfoSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  return guarded("saveProfileInfo", async () => {
    await updateProfileInfo(await getDb(), business.id, parsed.data);
    return ok(undefined);
  });
}

export async function saveSocialLinksAction(input: unknown): Promise<ActionResult> {
  const business = await currentBusiness();
  if (!business) return fail(copy.onboarding.guard.incomplete);
  const parsed = socialLinksSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  return guarded("saveSocialLinks", async () => {
    await updateSocialLinks(await getDb(), business.id, parsed.data);
    return ok(undefined);
  });
}

export async function changeSlugAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const business = await currentBusiness();
  if (!business) return fail(copy.onboarding.guard.incomplete);
  const parsed = slugChangeSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  if (parsed.data.slug === business.slug) return fail(copy.panel.profile.link.unchanged, "slug");

  return guarded("changeSlug", async () => {
    const result = await changeSlug(await getDb(), business.id, parsed.data.slug);
    return result.ok ? ok(result.data) : fail(copy.onboarding.business.slugTaken, "slug");
  });
}

export async function saveBookingSettingsAction(input: unknown): Promise<ActionResult> {
  const business = await currentBusiness();
  if (!business) return fail(copy.onboarding.guard.incomplete);
  const parsed = bookingSettingsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  return guarded("saveBookingSettings", async () => {
    await updateBookingSettings(await getDb(), business.id, parsed.data);
    return ok(undefined);
  });
}
