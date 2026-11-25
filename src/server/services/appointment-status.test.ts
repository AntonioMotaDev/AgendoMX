import { describe, expect, it } from "vitest";
import { availableActions, isOwnerAction, planTransition, type AppointmentStatus } from "./appointment-status";

const startsAt = new Date("2026-12-02T16:00:00Z");
const before = new Date("2026-12-02T10:00:00Z");
const after = new Date("2026-12-02T17:00:00Z");
const plan = (action: Parameters<typeof planTransition>[0], status: AppointmentStatus, now = before) => planTransition(action, { status, startsAt }, now);

describe("planTransition", () => {
  it("pending can be confirmed or rejected", () => {
    expect(plan("confirm", "pending")).toEqual({ ok: true, to: "confirmed", event: "confirmed", cancelledBy: null });
    expect(plan("reject", "pending")).toEqual({ ok: true, to: "rejected", event: "rejected", cancelledBy: null });
  });
  it("pending and confirmed can be cancelled by the business", () => {
    for (const status of ["pending", "confirmed"] as const) {
      expect(plan("cancel", status)).toEqual({ ok: true, to: "cancelled", event: "cancelled", cancelledBy: "business" });
    }
  });
  it("completed / no_show need a confirmed appointment that has started", () => {
    expect(plan("complete", "confirmed", before)).toEqual({ ok: false, reason: "not_started" });
    expect(plan("no_show", "confirmed", before)).toEqual({ ok: false, reason: "not_started" });
    expect(plan("complete", "confirmed", after)).toEqual({ ok: true, to: "completed", event: "completed", cancelledBy: null });
    expect(plan("no_show", "confirmed", startsAt)).toEqual({ ok: true, to: "no_show", event: "no_show", cancelledBy: null });
    expect(plan("complete", "pending", after)).toEqual({ ok: false, reason: "invalid_transition" });
  });
  it("final states accept nothing", () => {
    for (const status of ["cancelled", "completed", "no_show", "rejected", "expired"] as const) {
      for (const a of ["confirm", "reject", "cancel", "complete", "no_show"] as const) {
        expect(plan(a, status, after)).toEqual({ ok: false, reason: "invalid_transition" });
      }
    }
  });
  it("confirmed cannot be confirmed or rejected again", () => {
    expect(plan("confirm", "confirmed")).toEqual({ ok: false, reason: "invalid_transition" });
    expect(plan("reject", "confirmed")).toEqual({ ok: false, reason: "invalid_transition" });
  });
});

describe("availableActions", () => {
  it("lists what the UI may offer", () => {
    expect(availableActions({ status: "pending", startsAt }, before)).toEqual(["confirm", "reject", "cancel"]);
    expect(availableActions({ status: "confirmed", startsAt }, before)).toEqual(["cancel"]);
    expect(availableActions({ status: "confirmed", startsAt }, after)).toEqual(["cancel", "complete", "no_show"]);
    expect(availableActions({ status: "cancelled", startsAt }, after)).toEqual([]);
  });
});

describe("isOwnerAction", () => {
  it("accepts only known actions", () => {
    expect(isOwnerAction("confirm")).toBe(true);
    expect(isOwnerAction("delete")).toBe(false);
    expect(isOwnerAction(undefined)).toBe(false);
  });
});
