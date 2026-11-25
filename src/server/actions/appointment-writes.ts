import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { appointmentEvents, appointments } from "@/db/schema";
import { isUuid } from "@/lib/ids";
import { planTransition, type EventType, type OwnerAction } from "@/server/services/appointment-status";

export type ChangeStatusError = "not_found" | "invalid_transition" | "not_started";

export type ChangeStatusResult = { ok: true; data: { event: EventType } } | { ok: false; error: ChangeStatusError };

/**
 * Applies an owner action to one appointment of `businessId`. The row is locked
 * for the duration, so two taps (or two devices) cannot both win; the second
 * sees the new status and gets `invalid_transition`. Every change writes an event.
 */
export async function changeAppointmentStatus(db: Db, businessId: string, appointmentId: unknown, action: OwnerAction, now: Date): Promise<ChangeStatusResult> {
  if (!isUuid(appointmentId)) return { ok: false, error: "not_found" };
  return db.transaction(async (tx): Promise<ChangeStatusResult> => {
    const [row] = await tx
      .select({ id: appointments.id, status: appointments.status, startsAt: appointments.startsAt })
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.businessId, businessId)))
      .for("update")
      .limit(1);
    if (!row) return { ok: false, error: "not_found" };

    const plan = planTransition(action, row, now);
    if (!plan.ok) return { ok: false, error: plan.reason };

    await tx
      .update(appointments)
      .set({ status: plan.to, cancelledBy: plan.cancelledBy, ...(action === "confirm" ? { expiresAt: null } : {}) })
      .where(eq(appointments.id, row.id));
    await tx.insert(appointmentEvents).values({ appointmentId: row.id, type: plan.event, actor: "owner" });
    return { ok: true, data: { event: plan.event } };
  });
}
