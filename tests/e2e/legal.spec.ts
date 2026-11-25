import { expect, test } from "@playwright/test";
import { LEGAL_VERSION } from "../../src/lib/legal-content";
import { OWNER_A, PASSWORD } from "./support/fixtures";
import { withDb } from "./support/db";
import { hydrated, noHorizontalScroll, pickSlot } from "./support/helpers";

test.describe("legal pages and acceptance", () => {
  test("the terms and the owners' privacy notice are public and readable at 375px", async ({ page }) => {
    for (const [path, heading] of [
      ["/terminos", "Términos y condiciones para dueños de negocio"],
      ["/privacidad", "Aviso de privacidad para dueños de negocio"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await noHorizontalScroll(page);
    }
  });

  test("a business's customer notice names that business as the controller, with its own contact data", async ({ page }) => {
    await page.goto(`/${OWNER_A.slug}/privacidad`);
    await expect(page.getByText(`El responsable de tus datos es ${OWNER_A.business}`, { exact: false })).toBeVisible();
    await expect(page.getByText("WhatsApp 55 1234 5678")).toBeVisible();
    await expect(page.getByText(/\{[^}]+\}/)).toHaveCount(0);
    await noHorizontalScroll(page);
    expect((await page.goto("/no-existe-xyz/privacidad"))?.status()).toBe(404);
  });

  test("registration needs the box; accepting records the version and the time", async ({ page }) => {
    const email = `nueva-${Date.now()}@e2e.test`;
    await page.goto("/registro");
    await hydrated(page, 'button[type="submit"]');
    await page.getByLabel("Tu nombre").fill("Persona Nueva");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);

    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Para crear tu cuenta debes aceptar los términos y el aviso de privacidad.")).toBeVisible();
    await expect(page).toHaveURL(/\/registro/);

    await page.getByLabel(/He leído y acepto/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL(/verificar-correo/);

    const [row] = await withDb((sql) => sql<{ termsVersion: string; at: Date }[]>`select terms_version as "termsVersion", terms_accepted_at as at from "user" where email = ${email}`);
    expect(row!.termsVersion).toBe(LEGAL_VERSION);
    expect(Date.now() - new Date(row!.at).getTime()).toBeLessThan(60_000);
  });

  test("the server refuses a sign-up that does not carry the current version, whatever the form did", async ({ request }) => {
    for (const extra of [{}, { termsVersion: "0.0-old" }]) {
      const response = await request.post("/api/auth/sign-up/email", {
        data: { name: "Bot", email: `bot-${Date.now()}@e2e.test`, password: PASSWORD, ...extra },
        headers: { origin: "http://localhost:3100" },
      });
      expect(response.status()).toBe(400);
      expect(await response.text()).toContain("TERMS_NOT_ACCEPTED");
    }
  });

  test("the booking form shows the short notice naming the business, linked to its full notice", async ({ page }) => {
    await page.goto(`/${OWNER_A.slug}`);
    await page.locator(`a[href*="/${OWNER_A.slug}/reservar?servicio="]`, { hasText: "Corte de cabello" }).click();
    await pickSlot(page);
    const notice = page.getByText(`${OWNER_A.business} usará tu nombre, celular y correo`, { exact: false });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("AgendoMX");
    await noHorizontalScroll(page);
    await page.getByRole("link", { name: "Aviso de privacidad completo" }).click();
    await expect(page).toHaveURL(new RegExp(`/${OWNER_A.slug}/privacidad$`));
    await expect(page.getByText(`El responsable de tus datos es ${OWNER_A.business}`, { exact: false })).toBeVisible();
  });

  test("the public profile and the appointment page link to the notice", async ({ page }) => {
    await page.goto(`/${OWNER_A.slug}`);
    await expect(page.getByRole("link", { name: "Aviso de privacidad" })).toHaveAttribute("href", `/${OWNER_A.slug}/privacidad`);
  });
});
