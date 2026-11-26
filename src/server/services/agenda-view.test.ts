import { describe, expect, it } from "vitest";
import type { AgendaItem } from "@/server/queries/appointments";
import { buildAgendaCard, clockLabel, formatDuration, gapMinutes, nextUpcoming, untilLabel } from "./agenda-view";

const item = (over: Partial<AgendaItem> = {}): AgendaItem => ({
  id: "id-1",
  status: "confirmed",
  startsAt: new Date("2026-12-03T16:00:00Z"), // 10:00 in Mexico City
  endsAt: new Date("2026-12-03T16:45:00Z"),
  serviceName: "Corte",
  priceCents: 18000,
  clientName: "Ana López",
  clientPhone: "+525512345678",
  ...over,
});
const ctx = (category: "barbershop" | "psychology" = "barbershop", now = "2026-12-02T12:00:00Z") => ({
  business: { name: "Barbería Juan", category, timezone: "America/Mexico_City" },
  now: new Date(now),
});

describe("buildAgendaCard", () => {
  it("formats time range, price and the client's name", () => {
    const c = buildAgendaCard(item(), "today", ctx());
    expect(c.timeLabel).toMatch(/^10:00\s?a\.\s?m\.\s–\s10:45\s?a\.\s?m\.$/);
    expect(c.priceLabel).toBe("$180");
    expect(c.whenLabel).toContain("Jueves, 3 de diciembre");
  });
  it("offers a null price label when there is no price", () => {
    expect(buildAgendaCard(item({ priceCents: null }), "today", ctx()).priceLabel).toBeNull();
  });
  it("tomorrow: reminder message with first name, day, time and service", () => {
    const c = buildAgendaCard(item(), "tomorrow", ctx());
    expect(c.whatsappHref).toMatch(/^https:\/\/wa\.me\/525512345678\?text=/);
    const text = decodeURIComponent(c.whatsappHref!.split("text=")[1]!);
    expect(text).toContain("Hola Ana,");
    expect(text).toContain("Barbería Juan");
    expect(text).toContain("jueves 3 de diciembre");
    expect(text).toContain("(Corte)");
    expect(c.whatsappLabel).toBe("Recordar por WhatsApp");
  });
  it("tomorrow: health categories never name the service in the reminder", () => {
    const text = decodeURIComponent(buildAgendaCard(item({ serviceName: "Terapia" }), "tomorrow", ctx("psychology")).whatsappHref!.split("text=")[1]!);
    expect(text).not.toContain("Terapia");
    expect(text).not.toContain("(");
  });
  it("today: contact message; pending: plain chat link; closed-out appointments get no link", () => {
    expect(decodeURIComponent(buildAgendaCard(item(), "today", ctx()).whatsappHref!.split("text=")[1]!)).toContain("cita de hoy");
    expect(buildAgendaCard(item({ status: "pending" }), "pending", ctx()).whatsappHref).toBe("https://wa.me/525512345678");
    expect(buildAgendaCard(item({ status: "completed" }), "today", ctx()).whatsappHref).toBeNull();
  });
  it("week: plain chat link for live appointments, none for closed ones", () => {
    expect(buildAgendaCard(item(), "week", ctx()).whatsappHref).toBe("https://wa.me/525512345678");
    expect(buildAgendaCard(item({ status: "no_show" }), "week", ctx()).whatsappHref).toBeNull();
  });
  it("offers only the actions allowed right now", () => {
    expect(buildAgendaCard(item({ status: "pending" }), "pending", ctx()).actions).toEqual(["confirm", "reject", "cancel"]);
    expect(buildAgendaCard(item(), "today", ctx("barbershop", "2026-12-03T12:00:00Z")).actions).toEqual(["cancel"]);
    expect(buildAgendaCard(item(), "today", ctx("barbershop", "2026-12-03T17:00:00Z")).actions).toEqual(["cancel", "complete", "no_show"]);
    expect(buildAgendaCard(item({ status: "completed" }), "today", ctx()).actions).toEqual([]);
  });
});

describe("agenda timeline helpers", () => {
  const tz = "America/Mexico_City";
  it("shows the clock in the business's zone, 24 h", () => {
    expect(clockLabel(new Date("2026-12-03T16:00:00Z"), tz)).toBe("10:00");
    expect(clockLabel(new Date("2026-12-03T23:45:00Z"), tz)).toBe("17:45");
    expect(buildAgendaCard(item(), "today", ctx())).toMatchObject({ startClock: "10:00", endClock: "10:45" });
  });
  it("the next appointment is the first confirmed one that has not ended", () => {
    const items = [
      item({ id: "done", status: "completed", startsAt: new Date("2026-12-03T14:00:00Z"), endsAt: new Date("2026-12-03T14:45:00Z") }),
      item({ id: "asking", status: "pending", startsAt: new Date("2026-12-03T15:00:00Z"), endsAt: new Date("2026-12-03T15:45:00Z") }),
      item({ id: "now", startsAt: new Date("2026-12-03T16:00:00Z"), endsAt: new Date("2026-12-03T16:45:00Z") }),
      item({ id: "later", startsAt: new Date("2026-12-03T18:00:00Z"), endsAt: new Date("2026-12-03T18:45:00Z") }),
    ];
    expect(nextUpcoming(items, new Date("2026-12-03T15:30:00Z"))?.id).toBe("now");
    expect(nextUpcoming(items, new Date("2026-12-03T16:20:00Z"))?.id).toBe("now"); // still in progress
    expect(nextUpcoming(items, new Date("2026-12-03T16:50:00Z"))?.id).toBe("later");
    expect(nextUpcoming(items, new Date("2026-12-03T19:00:00Z"))).toBeNull();
  });
  it("only reports gaps of at least 30 minutes", () => {
    const a = { endsAt: new Date("2026-12-03T16:45:00Z") };
    expect(gapMinutes(a, { startsAt: new Date("2026-12-03T17:15:00Z") })).toBe(30);
    expect(gapMinutes(a, { startsAt: new Date("2026-12-03T17:00:00Z") })).toBeNull();
    expect(gapMinutes(a, { startsAt: new Date("2026-12-03T16:45:00Z") })).toBeNull();
  });
  it("formats durations and countdowns", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(75)).toBe("1 h 15 min");
    const now = new Date("2026-12-03T15:42:00Z");
    expect(untilLabel(new Date("2026-12-03T16:00:00Z"), now)).toBe("en 18 min");
    expect(untilLabel(new Date("2026-12-03T17:47:00Z"), now)).toBe("en 2 h 5 min");
    expect(untilLabel(new Date("2026-12-03T15:30:00Z"), now)).toBe("en curso");
  });
});
