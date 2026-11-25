import { expect, test } from "@playwright/test";
import { appointmentsOf, eventsOf, resetBookings, seedAppointment } from "./support/db";
import { OWNER_A, OWNER_B, PASSWORD } from "./support/fixtures";
import { hydrated, noHorizontalScroll, signIn } from "./support/helpers";

test.beforeEach(async () => {
  await resetBookings();
});

test.describe("owner panel", () => {
  test("signed-out visitors are sent to login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/app/semana");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an owner signs in through the form and lands on Hoy; a wrong password is refused", async ({ page }) => {
    await page.goto("/login");
    await hydrated(page, 'button[type="submit"]');
    await page.getByLabel("Correo electrónico").fill(OWNER_A.email);
    await page.getByLabel("Contraseña").fill("contrasena-incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/app/);
    await expect(page.getByRole("heading", { level: 1, name: "Hoy" })).toBeVisible();
    await noHorizontalScroll(page);
  });

  test("the owner accepts a pending request and the customer's link shows it confirmed", async ({ page, browser }) => {
    const request = await seedAppointment({ slug: OWNER_B.slug, status: "pending", startsInHours: 30, clientName: "Carla Núñez" });
    await signIn(page, OWNER_B);
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /Por confirmar · 1/ })).toBeVisible();
    await expect(page.getByText("Carla Núñez")).toBeVisible();
    await hydrated(page, "button");
    await page.getByRole("button", { name: "Aceptar" }).click();
    await expect(page.getByRole("heading", { name: /Por confirmar/ })).toHaveCount(0);

    const [saved] = await appointmentsOf(OWNER_B.slug);
    expect(saved).toMatchObject({ status: "confirmed" });
    expect(await eventsOf(saved!.id)).toEqual([{ type: "confirmed", actor: "owner" }]);

    const customer = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "es-MX" })).newPage();
    await customer.goto(`/cita/${request.token}`);
    await expect(customer.getByText("Confirmada", { exact: true })).toBeVisible();
    await customer.context().close();
  });

  test("rejecting asks first, then frees the slot for someone else", async ({ page }) => {
    const request = await seedAppointment({ slug: OWNER_B.slug, status: "pending", startsInHours: 30 });
    await signIn(page, OWNER_B);
    await page.goto("/app");
    await hydrated(page, "button");
    await page.getByRole("button", { name: "Rechazar" }).click();
    await expect(page.getByText(/¿Rechazar esta solicitud\?/)).toBeVisible();
    await page.getByRole("button", { name: "No", exact: true }).click(); // keep it
    expect((await appointmentsOf(OWNER_B.slug))[0]).toMatchObject({ status: "pending" });
    await page.getByRole("button", { name: "Rechazar" }).click();
    await page.getByRole("button", { name: "Sí, continuar" }).click();
    await expect(page.getByRole("heading", { name: /Por confirmar/ })).toHaveCount(0);
    expect((await appointmentsOf(OWNER_B.slug))[0]).toMatchObject({ id: request.id, status: "rejected" });
  });

  test("the owner cancels an appointment and the customer's link shows it cancelled", async ({ page, browser }) => {
    const appt = await seedAppointment({ slug: OWNER_A.slug, status: "confirmed", startsInHours: 3, clientName: "Beto Ramírez" });
    await signIn(page);
    await page.goto("/app");
    await expect(page.getByText("Beto Ramírez")).toBeVisible();
    await hydrated(page, "button");
    await page.getByRole("button", { name: "Cancelar cita" }).click();
    await page.getByRole("button", { name: "Sí, continuar" }).click();
    await expect(page.getByText("Beto Ramírez")).toHaveCount(0);

    expect((await appointmentsOf(OWNER_A.slug))[0]).toMatchObject({ status: "cancelled" });
    const customer = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "es-MX" })).newPage();
    await customer.goto(`/cita/${appt.token}`);
    await expect(customer.getByText("Cancelada", { exact: true }).first()).toBeVisible();
    await customer.context().close();
  });

  test("Mañana offers the WhatsApp reminder with a ready message", async ({ page }) => {
    await seedAppointment({ slug: OWNER_A.slug, status: "confirmed", startsInHours: 26, clientName: "Diana Soto", phone: "+525512340077" });
    await signIn(page);
    await page.goto("/app/manana");
    const link = page.getByRole("link", { name: "Recordar por WhatsApp" });
    await expect(link).toHaveCount(1);
    const href = decodeURIComponent((await link.getAttribute("href")) ?? "");
    expect(href).toContain("https://wa.me/525512340077?text=");
    expect(href).toContain("Hola Diana");
    expect(href).toContain(OWNER_A.business);
  });

  test("the owner creates a manual appointment, it shows in Semana, and the public flow then sees the slot taken", async ({ page, browser }) => {
    await signIn(page);
    await page.goto("/app/citas/nueva");
    const days = page.getByRole("radiogroup", { name: "Día" }).getByRole("radio");
    await days.nth(2).waitFor();
    // A day two ahead, chosen by its full label so the public page can be matched to it exactly.
    const dayLabel = (await days.nth(2).getAttribute("aria-label"))!;
    await days.nth(2).click();
    const times = page.getByRole("radiogroup", { name: "Hora" }).getByRole("radio");
    const slot = (await times.nth(2).innerText()).trim();
    await times.nth(2).click();
    await page.getByLabel("Nombre").fill("Cliente Manual");
    await page.getByLabel("Celular").fill("55 8765 4321");
    await page.getByRole("button", { name: "Agendar cita" }).click();

    await page.waitForURL(/\/app\/semana/);
    await expect(page.getByText("Cliente Manual")).toBeVisible();
    const [saved] = await appointmentsOf(OWNER_A.slug);
    expect(saved).toMatchObject({ status: "confirmed", source: "manual" });
    expect(await eventsOf(saved!.id)).toEqual([{ type: "created", actor: "owner" }]);

    // The public booking page no longer offers that time on that day (and still offers the others).
    const customer = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "es-MX", timezoneId: "America/Mexico_City" })).newPage();
    await customer.goto(`/${OWNER_A.slug}`);
    await customer.locator('a[href*="/reservar?servicio="]', { hasText: "Corte de cabello" }).click();
    await customer.getByRole("radio", { name: dayLabel }).click();
    const offered = await customer.getByRole("radiogroup", { name: "Hora" }).getByRole("radio").allInnerTexts();
    expect(offered.length).toBeGreaterThan(5);
    expect(offered).not.toContain(slot);
    await customer.context().close();
  });

  test("Semana navigates between weeks", async ({ page }) => {
    await signIn(page);
    await page.goto("/app/semana");
    await expect(page.getByRole("heading", { level: 1, name: "Semana" })).toBeVisible();
    await expect(page.getByText("Esta semana")).toBeVisible();
    const first = await page.getByRole("heading", { level: 2 }).first().innerText();
    await page.getByRole("link", { name: "Semana siguiente" }).click();
    await expect(page).toHaveURL(/semana\?s=/);
    await expect(page.getByRole("link", { name: "Esta semana" })).toBeVisible();
    expect(await page.getByRole("heading", { level: 2 }).first().innerText()).not.toBe(first);
    await noHorizontalScroll(page);
  });

  test("one business never sees another business's appointments or customers", async ({ page }) => {
    await seedAppointment({ slug: OWNER_A.slug, status: "confirmed", startsInHours: 3, clientName: "Cliente Secreto de A", phone: "+525512340055" });
    await seedAppointment({ slug: OWNER_B.slug, status: "pending", startsInHours: 30, clientName: "Cliente de B", phone: "+525512340056" });

    await signIn(page, OWNER_B);
    for (const path of ["/app", "/app/manana", "/app/semana"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Cliente Secreto de A")).toHaveCount(0);
    }
    await page.goto("/app");
    await expect(page.getByText("Cliente de B")).toBeVisible();

    // And the manual form offers only B's own services.
    await page.goto("/app/citas/nueva");
    await expect(page.getByRole("radio", { name: /Consulta/ })).toBeVisible();
    await expect(page.getByText("Corte de cabello")).toHaveCount(0);
  });

  test("the same time cannot be booked twice by hand, even picking a custom hour", async ({ page }) => {
    await signIn(page);
    // First: a regular offered slot.
    await page.goto("/app/citas/nueva");
    await page.getByRole("radiogroup", { name: "Hora" }).getByRole("radio").nth(1).click();
    await page.getByLabel("Nombre").fill("Persona 1");
    await page.getByLabel("Celular").fill("55 2222 0001");
    await page.getByRole("button", { name: "Agendar cita" }).click();
    await page.waitForURL(/\/app\/semana/);
    const [first] = await appointmentsOf(OWNER_A.slug);
    const local = (opts: Intl.DateTimeFormatOptions, locale: string) => new Date(first!.startsAt).toLocaleString(locale, { timeZone: "America/Mexico_City", ...opts });

    // Second: the same moment through "hora distinta", overlapping by 15 minutes.
    await page.goto("/app/citas/nueva");
    await page.getByRole("button", { name: "Elegir una hora distinta" }).click();
    await page.getByLabel("Día", { exact: true }).fill(local({ year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA"));
    await page.getByLabel("Hora", { exact: true }).fill(local({ hour: "2-digit", minute: "2-digit", hour12: false }, "en-GB"));
    await page.getByLabel("Nombre").fill("Persona 2");
    await page.getByLabel("Celular").fill("55 2222 0002");
    await page.getByRole("button", { name: "Agendar cita" }).click();
    await expect(page.getByText("Ese horario acaba de ocuparse, elige otro.")).toBeVisible();
    expect(await appointmentsOf(OWNER_A.slug)).toHaveLength(1);
  });
});
