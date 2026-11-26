import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { businesses } from "@/db/schema";
import type { BookingSettingsData, ProfileInfoData, SocialLinksData, ThemeData } from "@/lib/validators/profile";
import type { WriteResult } from "./business-writes";

/** Every update is keyed by the session's businessId; no function here takes a business from request data. */

export async function updateProfileInfo(db: Db, businessId: string, data: ProfileInfoData): Promise<void> {
  await db
    .update(businesses)
    .set({
      name: data.name,
      category: data.category,
      categoryOther: data.categoryOther,
      state: data.state,
      city: data.city,
      description: data.description,
      address: data.address,
      mapsUrl: data.mapsUrl,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
    })
    .where(eq(businesses.id, businessId));
}

export async function updateSocialLinks(db: Db, businessId: string, links: SocialLinksData): Promise<void> {
  await db
    .update(businesses)
    .set({
      instagramUrl: links.instagram,
      facebookUrl: links.facebook,
      tiktokUrl: links.tiktok,
      youtubeUrl: links.youtube,
      twitterUrl: links.twitter,
      linkedinUrl: links.linkedin,
    })
    .where(eq(businesses.id, businessId));
}

/** Changes the public link. The old one stops working immediately (no redirect in the MVP). */
export async function changeSlug(db: Db, businessId: string, slug: string): Promise<WriteResult<{ slug: string }>> {
  try {
    await db.update(businesses).set({ slug }).where(eq(businesses.id, businessId));
    return { ok: true, data: { slug } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slug_taken" };
    throw error;
  }
}

export async function updateBookingSettings(db: Db, businessId: string, data: BookingSettingsData): Promise<void> {
  await db
    .update(businesses)
    .set({
      confirmationMode: data.confirmationMode,
      pendingExpiryHours: data.pendingExpiryHours,
      bookingLeadTimeMin: data.bookingLeadTimeMin,
      bookingWindowDays: data.bookingWindowDays,
      cancellationMinHours: data.cancellationMinHours,
      cancellationPolicyText: data.cancellationPolicyText,
    })
    .where(eq(businesses.id, businessId));
}

export async function updateTheme(db: Db, businessId: string, data: ThemeData): Promise<void> {
  await db.update(businesses).set({ theme: data.theme }).where(eq(businesses.id, businessId));
}
