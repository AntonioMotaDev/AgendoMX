import { describe, expect, it } from "vitest";
import {
  bookingTimes,
  cancellationDeadline,
  checkClientCancellation,
  initialAppointment,
  isPublicToken,
  isSensitiveCategory,
  parseRequestedStart,
  publicBookingRequirements,
  selectableCategories,
} from "./booking";
import { generatePublicToken } from "@/lib/tokens";

const at = (iso: string) => new Date(iso);

describe("bookingTimes", () => {
  it("ends after the duration and blocks through the buffer", () => {
    const t = bookingTimes(at("2026-12-01T16:00:00Z"), 45, 15);
    expect(t.startsAt.toISOString()).toBe("2026-12-01T16:00:00.000Z");
    expect(t.endsAt.toISOString()).toBe("2026-12-01T16:45:00.000Z");
    expect(t.blockedUntil.toISOString()).toBe("2026-12-01T17:00:00.000Z");
  });
  it("without a buffer, blocked_until equals ends_at (the DB check allows it)", () => {
    const t = bookingTimes(at("2026-12-01T16:00:00Z"), 30, 0);
    expect(t.blockedUntil.getTime()).toBe(t.endsAt.getTime());
  });
  it("does not alias the input date", () => {
    const start = at("2026-12-01T16:00:00Z");
    const t = bookingTimes(start, 30, 0);
    start.setUTCHours(20);
    expect(t.startsAt.toISOString()).toBe("2026-12-01T16:00:00.000Z");
  });
});

describe("initialAppointment", () => {
  const now = at("2026-12-01T12:00:00Z");
  it("auto mode confirms at once", () => {
    expect(initialAppointment("auto", now, 24)).toEqual({ status: "confirmed", expiresAt: null });
  });
  it("manual mode holds the slot until the expiry", () => {
    const r = initialAppointment("manual", now, 48);
    expect(r.status).toBe("pending");
    expect(r.expiresAt?.toISOString()).toBe("2026-12-03T12:00:00.000Z");
  });
});

describe("checkClientCancellation", () => {
  const startsAt = at("2026-12-10T18:00:00Z");
  const base = { status: "confirmed", startsAt, cancellationMinHours: 4 };

  it("allows cancelling well before the deadline, and right at it", () => {
    expect(checkClientCancellation({ ...base, now: at("2026-12-09T10:00:00Z") })).toEqual({ ok: true });
    expect(checkClientCancellation({ ...base, now: cancellationDeadline(startsAt, 4) })).toEqual({ ok: true });
  });
  it("refuses after the deadline but before the start: too_late", () => {
    expect(checkClientCancellation({ ...base, now: at("2026-12-10T14:00:01Z") })).toEqual({ ok: false, reason: "too_late" });
  });
  it("refuses once it has started", () => {
    expect(checkClientCancellation({ ...base, now: at("2026-12-10T18:00:00Z") })).toEqual({ ok: false, reason: "started" });
    expect(checkClientCancellation({ ...base, now: at("2026-12-11T00:00:00Z") })).toEqual({ ok: false, reason: "started" });
  });
  it("only pending and confirmed appointments can be cancelled", () => {
    for (const status of ["cancelled", "completed", "no_show", "rejected", "expired"]) {
      expect(checkClientCancellation({ ...base, status, now: at("2026-12-01T00:00:00Z") })).toEqual({ ok: false, reason: "status" });
    }
    expect(checkClientCancellation({ ...base, status: "pending", now: at("2026-12-01T00:00:00Z") })).toEqual({ ok: true });
  });
  it("a zero-hour policy lets clients cancel until the start", () => {
    const now = at("2026-12-10T17:59:00Z");
    expect(checkClientCancellation({ ...base, cancellationMinHours: 0, now })).toEqual({ ok: true });
    expect(checkClientCancellation({ ...base, cancellationMinHours: 0, now: at("2026-12-10T18:00:00Z") })).toEqual({ ok: false, reason: "started" });
  });
});

describe("isPublicToken", () => {
  it("accepts tokens we generate and rejects everything else", () => {
    for (let i = 0; i < 50; i++) expect(isPublicToken(generatePublicToken())).toBe(true);
    for (const bad of ["", "short", "a".repeat(31), "a".repeat(33), `${"a".repeat(31)}/`, `${"a".repeat(31)} `, "a".repeat(31) + "é", null, undefined, 42, `${"a".repeat(30)}..`]) {
      expect(isPublicToken(bad)).toBe(false);
    }
  });
});

describe("parseRequestedStart", () => {
  it("accepts a whole-minute ISO instant", () => {
    expect(parseRequestedStart("2026-12-01T16:15:00.000Z")?.toISOString()).toBe("2026-12-01T16:15:00.000Z");
  });
  it("rejects anything else: offsets, seconds, milliseconds, impossible dates, wrong types", () => {
    for (const bad of [
      "2026-12-01T16:15:00Z", "2026-12-01T16:15:00.000+00:00", "2026-12-01T10:15:00.000-06:00", "2026-12-01T16:15:30.000Z",
      "2026-12-01T16:15:00.500Z", "2026-13-01T16:15:00.000Z", "2026-02-30T16:15:00.000Z", "2026-12-01T25:15:00.000Z",
      "mañana", "", null, undefined, 1795000000000, {},
    ]) expect(parseRequestedStart(bad)).toBeNull();
  });
});

describe("publicBookingRequirements", () => {
  const complete = { category: "barbershop" as const, address: "Juárez 123", city: "Puebla", state: "Puebla", phone: null, whatsapp: "+525512345678" };
  const off = { published: false, healthEnabled: false };
  const live = { published: true, healthEnabled: false };
  const liveWithHealth = { published: true, healthEnabled: true };
  const HEALTH = ["physiotherapy", "psychology", "nutrition", "dentistry", "medical"] as const;

  it("asks nothing while the legal texts are not published, whatever the business looks like", () => {
    const bare = { category: "psychology" as const, address: null, city: null, state: null, phone: null, whatsapp: null };
    expect(publicBookingRequirements(off, bare)).toEqual({ closed: false, missing: [], healthUnavailable: false, needsHealthConsent: false });
    expect(publicBookingRequirements({ published: false, healthEnabled: true }, bare).closed).toBe(false);
  });

  it("a complete general business is open and needs no authorization box", () => {
    expect(publicBookingRequirements(live, complete)).toEqual({ closed: false, missing: [], healthUnavailable: false, needsHealthConsent: false });
  });

  it("health categories are closed to online bookings until they are admitted", () => {
    for (const category of HEALTH) {
      expect(publicBookingRequirements(live, { ...complete, category }), category).toEqual({ closed: true, missing: [], healthUnavailable: true, needsHealthConsent: false });
    }
  });

  it("once admitted, each health category needs the authorization box and the rest do not", () => {
    for (const category of HEALTH) expect(publicBookingRequirements(liveWithHealth, { ...complete, category }), category).toMatchObject({ closed: false, needsHealthConsent: true });
    for (const category of ["barbershop", "beauty_salon", "nails", "spa", "fitness", "tattoo", "other"] as const) {
      expect(publicBookingRequirements(liveWithHealth, { ...complete, category }).needsHealthConsent, category).toBe(false);
    }
  });

  it("a business without address or contact is closed to online bookings and says what is missing", () => {
    expect(publicBookingRequirements(live, { ...complete, address: null })).toMatchObject({ closed: true, missing: ["address"] });
    expect(publicBookingRequirements(live, { ...complete, whatsapp: null })).toMatchObject({ closed: true, missing: ["contact"] });
  });
});

describe("selectableCategories", () => {
  const HEALTH = ["physiotherapy", "psychology", "nutrition", "dentistry", "medical"];

  it("offers everything while the legal texts are not published", () => {
    expect(selectableCategories({ published: false, healthEnabled: false })).toHaveLength(12);
  });

  it("hides the five health categories once published, and keeps the other seven", () => {
    const list = selectableCategories({ published: true, healthEnabled: false });
    expect(list).toHaveLength(7);
    for (const c of HEALTH) expect(list).not.toContain(c);
    expect(list).toContain("other");
  });

  it("keeps the business's own health category so editing its profile does not break it", () => {
    expect(selectableCategories({ published: true, healthEnabled: false }, "psychology")).toContain("psychology");
    expect(selectableCategories({ published: true, healthEnabled: false }, "psychology")).not.toContain("nutrition");
  });

  it("offers everything again when health is admitted", () => {
    expect(selectableCategories({ published: true, healthEnabled: true })).toHaveLength(12);
  });
});

describe("isSensitiveCategory", () => {
  it("flags health categories only", () => {
    for (const c of ["physiotherapy", "psychology", "nutrition", "dentistry", "medical"] as const) expect(isSensitiveCategory(c)).toBe(true);
    for (const c of ["barbershop", "beauty_salon", "nails", "spa", "fitness", "tattoo", "other"] as const) expect(isSensitiveCategory(c)).toBe(false);
  });
});
