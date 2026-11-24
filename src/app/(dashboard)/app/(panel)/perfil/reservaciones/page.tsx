import type { Metadata } from "next";
import { BookingSettingsForm } from "@/components/dashboard/booking-settings-form";
import { ProfileSubpage } from "@/components/dashboard/profile-subpage";
import { copy } from "@/lib/copy";
import { getCurrentBusiness } from "@/lib/session";

export const metadata: Metadata = { title: "Reservaciones — AgendoMX", robots: { index: false } };

export default async function BookingSettingsPage() {
  const b = (await getCurrentBusiness())!;
  return (
    <ProfileSubpage title={copy.panel.profile.booking.title}>
      <BookingSettingsForm
        initial={{
          confirmationMode: b.confirmationMode,
          pendingExpiryHours: b.pendingExpiryHours,
          bookingLeadTimeMin: b.bookingLeadTimeMin,
          bookingWindowDays: b.bookingWindowDays,
          cancellationMinHours: b.cancellationMinHours,
          cancellationPolicyText: b.cancellationPolicyText ?? "",
        }}
      />
    </ProfileSubpage>
  );
}
