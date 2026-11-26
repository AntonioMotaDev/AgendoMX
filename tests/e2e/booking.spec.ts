import { expect, test } from "@playwright/test";
import { appointmentsOf, eventsOf, resetBookings } from "./support/db";
import { OWNER_A, OWNER_B } from "./support/fixtures";
import { fillClient, hydrated, noHorizontalScroll, pickSlot } from "./support/helpers";

test.beforeEach(async () => {
  await resetBookings();
});

async function startBooking(page: import("@playwright/test").Page, slug = OWNER_A.slug, service = "Corte de cabello") {
  await page.goto(`/${slug}`);
  await page.locator(`a[href*="/${slug}/reservar?servicio="]`, { hasText: service }).click();
  await page.waitForURL(/\/reservar/);
}

test.describe("public booking", () => {
  test("the profile shows the business, its services and the booking button", async ({ page }) => {
    await page.goto(`/${OWNER_A.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: OWNER_A.business })).toBeVisible();
    await expect(page.getByText("$180")).toBeVisible();
    await expect(page.getByText("45 min")).toBeVisible();
    await expect(page.getByRole("link", { name: "Agendar cita" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cómo llegar" })).toBeVisible();
    await noHorizontalScroll(page);
  });

  test("a customer books, sees the confirmation, and cancels from their private link", async ({ page }) => {
    await startBooking(page);
    const slot = await pickSlot(page);
    await expect(page.getByText("Corte de cabello").first()).toBeVisible();
    await fillClient(page, { name: "Ana López", email: "ana@e2e.test" });
    await noHorizontalScroll(page);
    await page.getByRole("button", { name: "Confirmar cita" }).click();

    await page.waitForURL(/\/cita\/[\w-]{32}/);
    await expect(page.getByText("¡Listo, tu cita quedó confirmada!")).toBeVisible();
    await expect(page.getByText("Confirmada", { exact: true })).toBeVisible();
    await expect(page.getByText(slot.replace(/\s/g, " "), { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Ana López")).toBeVisible();

    // What the app wrote: one confirmed public booking with its audit event.
    const [saved] = await appointmentsOf(OWNER_A.slug);
    expect(saved).toMatchObject({ status: "confirmed", source: "public_link", clientName: "Ana López", clientEmail: "ana@e2e.test" });
    expect(await eventsOf(saved!.id)).toEqual([{ type: "created", actor: "client" }]);

    // Cancel: asked twice (no accidental cancellations).
    await hydrated(page, "button");
    await page.getByRole("button", { name: "Cancelar cita" }).click();
    await expect(page.getByText("¿Seguro que quieres cancelar tu cita?")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar cita" }).last().click();
    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar cita" })).toHaveCount(0);

    const [after] = await appointmentsOf(OWNER_A.slug);
    expect(after).toMatchObject({ status: "cancelled" });
    expect((await eventsOf(after!.id)).map((e) => e.type)).toEqual(["created", "cancelled"]);
  });

  test("a cancelled slot can be booked again", async ({ page, browser }) => {
    await startBooking(page);
    const slot = await pickSlot(page);
    await fillClient(page);
    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await page.waitForURL(/\/cita\//);
    await hydrated(page, "button");
    await page.getByRole("button", { name: "Cancelar cita" }).click();
    await page.getByRole("button", { name: "Cancelar cita" }).last().click();
    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();

    const other = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "es-MX", timezoneId: "America/Mexico_City" })).newPage();
    await startBooking(other);
    expect(await pickSlot(other)).toBe(slot);
    await fillClient(other);
    await other.getByRole("button", { name: "Confirmar cita" }).click();
    await other.waitForURL(/\/cita\//);
    await expect(other.getByText("¡Listo, tu cita quedó confirmada!")).toBeVisible();
    await other.context().close();
  });

  test("two people cannot take the same slot: the second is told and sees the updated times", async ({ page, browser }) => {
    const second = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "es-MX", timezoneId: "America/Mexico_City" })).newPage();

    await startBooking(page);
    const slot = await pickSlot(page);
    await fillClient(page, { name: "Primera Persona" });

    await startBooking(second);
    expect(await pickSlot(second)).toBe(slot); // both are looking at the very same time
    await fillClient(second, { name: "Segunda Persona" });

    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await page.waitForURL(/\/cita\//);

    await second.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(second.getByText("Ese horario acaba de ocuparse, elige otro.")).toBeVisible();
    // Sent back to the time step, where the taken slot is gone.
    // The list comes back on the first open day: go to the day the slot was on (pickSlot uses the third) to see it gone.
    await second.getByRole("radiogroup", { name: "Día" }).getByRole("radio").nth(2).click();
    const times = second.getByRole("radiogroup", { name: "Hora" }).getByRole("radio");
    await times.first().waitFor();
    expect(await times.allInnerTexts()).not.toContain(slot);

    const saved = await appointmentsOf(OWNER_A.slug);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.clientName).toBe("Primera Persona");
    await second.context().close();
  });

  test("an invalid phone is rejected and nothing is created", async ({ page }) => {
    await startBooking(page);
    await pickSlot(page);
    await fillClient(page, { phone: "123" });
    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(page.getByText("Escribe un celular válido de México, a 10 dígitos.")).toBeVisible();
    expect(await appointmentsOf(OWNER_A.slug)).toHaveLength(0);
  });

  test("a bot that fills the hidden honeypot field gets nothing", async ({ page }) => {
    await startBooking(page);
    await pickSlot(page);
    await fillClient(page);
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('input[name="website"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "https://spam.example");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(page.getByText("No pudimos agendar tu cita. Intenta de nuevo.")).toBeVisible();
    expect(await appointmentsOf(OWNER_A.slug)).toHaveLength(0);
  });

  test("a business that approves by hand receives a pending request", async ({ page }) => {
    await startBooking(page, OWNER_B.slug, "Consulta");
    await pickSlot(page);
    await expect(page.getByText(/confirma cada cita/)).toBeVisible();
    await fillClient(page, { name: "Persona Pendiente" });
    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await page.waitForURL(/\/cita\//);
    await expect(page.getByText("Recibimos tu solicitud")).toBeVisible();
    await expect(page.getByText("Pendiente de confirmar")).toBeVisible();
    const [saved] = await appointmentsOf(OWNER_B.slug);
    expect(saved).toMatchObject({ status: "pending", source: "public_link" });
  });

  test("a made-up appointment link shows a friendly not-found page", async ({ page }) => {
    const response = await page.goto(`/cita/${"a".repeat(32)}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("No encontramos esta cita")).toBeVisible();
  });

  test("an unknown business shows a friendly not-found page", async ({ page }) => {
    const response = await page.goto("/no-existe-este-negocio");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("No encontramos este negocio")).toBeVisible();
  });
});
