/**
 * Owner-driven appointment state changes. Pure, no I/O.
 * Valid transitions (docs/PRODUCT_SPEC.md §3):
 *   pending   -> confirmed | rejected | cancelled   (expiry is the cron's job)
 *   confirmed -> completed | no_show | cancelled
 * Completed / no_show only make sense once the appointment has started.
 */
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show" | "rejected" | "expired";
export type OwnerAction = "confirm" | "reject" | "cancel" | "complete" | "no_show";
export type EventType = "confirmed" | "rejected" | "cancelled" | "completed" | "no_show";

export type Transition =
  | { ok: true; to: AppointmentStatus; event: EventType; cancelledBy: "business" | null }
  | { ok: false; reason: "invalid_transition" | "not_started" };

const RULES: Record<OwnerAction, { from: readonly AppointmentStatus[]; to: AppointmentStatus; event: EventType; needsStarted?: true }> = {
  confirm: { from: ["pending"], to: "confirmed", event: "confirmed" },
  reject: { from: ["pending"], to: "rejected", event: "rejected" },
  cancel: { from: ["pending", "confirmed"], to: "cancelled", event: "cancelled" },
  complete: { from: ["confirmed"], to: "completed", event: "completed", needsStarted: true },
  no_show: { from: ["confirmed"], to: "no_show", event: "no_show", needsStarted: true },
};

export const OWNER_ACTIONS = Object.keys(RULES) as OwnerAction[];

export function isOwnerAction(value: unknown): value is OwnerAction {
  return typeof value === "string" && (OWNER_ACTIONS as string[]).includes(value);
}

export function planTransition(action: OwnerAction, current: { status: AppointmentStatus; startsAt: Date }, now: Date): Transition {
  const rule = RULES[action];
  if (!rule.from.includes(current.status)) return { ok: false, reason: "invalid_transition" };
  if (rule.needsStarted && now.getTime() < current.startsAt.getTime()) return { ok: false, reason: "not_started" };
  return { ok: true, to: rule.to, event: rule.event, cancelledBy: action === "cancel" ? "business" : null };
}

/** Actions the owner can take right now; drives which buttons the UI shows. */
export function availableActions(current: { status: AppointmentStatus; startsAt: Date }, now: Date): OwnerAction[] {
  return OWNER_ACTIONS.filter((a) => planTransition(a, current, now).ok);
}
