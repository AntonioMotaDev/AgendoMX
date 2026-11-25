"use server";

import { getDb } from "@/db";
import { copy } from "@/lib/copy";
import { inBackground } from "@/lib/email/send";
import { sendClientBookingEmail, sendClientStatusEmail } from "@/lib/email/booking-emails";
import { requireOwner, getCurrentBusiness } from "@/lib/session";
import { getOwnerAppointment } from "@/server/queries/appointments";
import { isOwnerAction } from "@/server/services/appointment-status";
import { changeAppointmentStatus } from "./appointment-writes";
import { guarded } from "./helpers";
import { fail, ok, type ActionResult } from "./result";

const e = copy.panel.agenda.errors;

/**
 * Confirm / reject / cancel / complete / no-show for one appointment of the
 * signed-in owner's business. The business comes from the session, never from
 * the request. The client is emailed (if they left an address) for the three
 * changes that concern them.
 */
export async function changeAppointmentStatusAction(raw: unknown): Promise<ActionResult<{ action: string }>> {
  return guarded("changeAppointmentStatus", async () => {
    await requireOwner();
    const business = await getCurrentBusiness();
    if (!business) return fail(e.generic);

    const input = typeof raw === "object" && raw !== null ? (raw as { id?: unknown; action?: unknown }) : {};
    if (!isOwnerAction(input.action)) return fail(e.generic);
    const action = input.action;

    const db = await getDb();
    const result = await changeAppointmentStatus(db, business.id, input.id, action, new Date());
    if (!result.ok) {
      if (result.error === "not_found") return fail(e.notFound);
      if (result.error === "not_started") return fail(e.notStarted);
      return fail(e.invalid);
    }

    if (action === "confirm" || action === "reject" || action === "cancel") {
      const detail = await getOwnerAppointment(db, business.id, input.id);
      if (detail?.clientEmail) {
        const email =
          action === "confirm"
            ? sendClientBookingEmail({
                to: detail.clientEmail,
                clientName: detail.clientName,
                token: detail.publicToken,
                status: "confirmed",
                startsAt: detail.startsAt,
                serviceName: detail.serviceName,
                business: detail.business,
              })
            : sendClientStatusEmail({
                to: detail.clientEmail,
                clientName: detail.clientName,
                kind: action === "reject" ? "rejected" : "cancelled",
                startsAt: detail.startsAt,
                serviceName: detail.serviceName,
                business: detail.business,
              });
        await inBackground(email, `appointment-${action}-client-email`);
      }
    }
    return ok({ action });
  });
}
