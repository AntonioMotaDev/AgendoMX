import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ appUrl: () => "https://agendomx.test" }));
const published = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/legal", () => ({ legalPublished: () => published.value }));
const sent = vi.hoisted(() => ({ messages: [] as Array<{ to: string; subject: string; text: string }> }));
vi.mock("./send", () => ({
  sendEmail: async (message: { to: string; subject: string; text: string }) => {
    sent.messages.push(message);
  },
}));

import { sendClientBookingEmail, sendClientStatusEmail, sendOwnerBookingEmail, sendReminderEmail } from "./booking-emails";

const business = { name: "Barbería Juan", slug: "barberia-juan", category: "barbershop" as const, timezone: "America/Mexico_City", address: "Juárez 123", city: "Puebla", cancellationMinHours: 4 };
const startsAt = new Date("2026-12-02T16:00:00Z");

async function sendAll() {
  await sendClientBookingEmail({ to: "ana@example.com", clientName: "Ana", token: "t".repeat(32), status: "confirmed", startsAt, serviceName: "Corte", business });
  await sendReminderEmail({ to: "ana@example.com", clientName: "Ana", token: "t".repeat(32), startsAt, serviceName: "Corte", business });
  await sendClientStatusEmail({ to: "ana@example.com", clientName: "Ana", kind: "cancelled", startsAt, serviceName: "Corte", business });
  await sendOwnerBookingEmail({ to: "juan@example.com", ownerName: "Juan", kind: "new", clientName: "Ana", clientPhone: "+525512345678", startsAt, serviceName: "Corte", timezone: business.timezone });
}

describe("privacy notice link in transactional emails", () => {
  beforeEach(() => {
    sent.messages.length = 0;
  });

  it("is absent while the legal pages are not published (they would be a 404)", async () => {
    published.value = false;
    await sendAll();
    expect(sent.messages).toHaveLength(4);
    for (const m of sent.messages) expect(m.text).not.toContain("/privacidad");
  });

  it("points clients to their business's own notice and the owner to the owners' notice", async () => {
    published.value = true;
    await sendAll();
    const [confirmation, reminder, status, owner] = sent.messages;
    for (const m of [confirmation, reminder, status]) expect(m!.text).toContain("Aviso de privacidad: https://agendomx.test/barberia-juan/privacidad");
    expect(owner!.text).toContain("Aviso de privacidad: https://agendomx.test/privacidad");
    expect(owner!.text).not.toContain("barberia-juan/privacidad");
  });

  it("health categories still never name the service, with or without the link", async () => {
    published.value = true;
    await sendClientBookingEmail({ to: "ana@example.com", clientName: "Ana", token: "t".repeat(32), status: "confirmed", startsAt, serviceName: "Terapia de pareja", business: { ...business, category: "psychology" } });
    expect(sent.messages[0]!.text).not.toContain("Terapia de pareja");
  });
});
