import { describe, expect, it } from "vitest";
import {
  bookingTimes,
  cancellationDeadline,
  checkClientCancellation,
  initialAppointment,
  isPublicToken,
  isSensitiveCategory,
  parseRequestedStart,
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

describe("isSensitiveCategory", () => {
  it("flags health categories only", () => {
    for (const c of ["physiotherapy", "psychology", "nutrition", "dentistry", "medical"] as const) expect(isSensitiveCategory(c)).toBe(true);
    for (const c of ["barbershop", "beauty_salon", "nails", "spa", "fitness", "tattoo", "other"] as const) expect(isSensitiveCategory(c)).toBe(false);
  });
});
