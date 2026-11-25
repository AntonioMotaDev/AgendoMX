import { expect, test } from "@playwright/test";
import { LEGAL_VERSION } from "../../src/lib/legal-content";
import { OWNER_A, PASSWORD } from "./support/fixtures";
import { removeOwner, resetBookings, withDb } from "./support/db";
import { fillClient, hydrated, noHorizontalScroll, pickSlot, signIn } from "./support/helpers";
import { seedOwner } from "./support/seed";

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
    const notice = page.getByText(`${OWNER_A.business}, con domicilio en Juárez 123, Guadalajara, Jalisco, es el responsable de tus datos`, { exact: false });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("usará tu nombre, celular y correo");
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

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** Owners these tests create are removed afterwards: the global fixtures stay exactly the two seeded owners. */
const created: string[] = [];
async function seedTemp(spec: Parameters<typeof seedOwner>[0]) {
  created.push(spec.email);
  return seedOwner(spec);
}
test.afterEach(async () => {
  for (const email of created.splice(0)) await removeOwner(email);
});

test.describe("booking requirements while the legal texts are published", () => {
  test("a health business asks for the express authorization; the booking stores the evidence", async ({ page }) => {
    const id = stamp();
    const spec = { email: `salud-${id}@e2e.test`, name: "Dra. Salud", business: `Consultorio ${id}`, slug: `consultorio-${id}`, mode: "auto" as const, category: "psychology", services: [{ name: "Sesión", minutes: 50, priceCents: 90000, buffer: 0 }] };
    await seedTemp(spec);

    await page.goto(`/${spec.slug}/reservar`);
    await pickSlot(page);
    await fillClient(page);
    const consent = page.getByLabel(/Autorizo expresamente/);
    await expect(consent).toBeVisible();
    await noHorizontalScroll(page);
    const confirm = page.getByRole("button", { name: "Confirmar cita" });
    await expect(confirm).toBeDisabled();
    // The server enforces it too: forcing the button on (as a tampered client would) is still refused.
    await confirm.evaluate((el) => el.removeAttribute("disabled"));
    await confirm.click();
    await expect(page.getByText("necesitamos tu autorización")).toBeVisible();
    expect(await withDb((sql) => sql`select 1 from appointments a join businesses b on b.id = a.business_id where b.slug = ${spec.slug}`)).toHaveLength(0);
    await consent.check();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await page.waitForURL(/\/cita\//);

    const [row] = await withDb((sql) => sql<{ version: string | null; at: Date | null }[]>`
      select a.privacy_notice_version as version, a.health_consent_at as at from appointments a join businesses b on b.id = a.business_id where b.slug = ${spec.slug}`);
    expect(row!.version).toBe(LEGAL_VERSION);
    expect(Date.now() - new Date(row!.at!).getTime()).toBeLessThan(60_000);
  });

  test("a general business shows no authorization box and stores only the notice version", async ({ page }) => {
    await resetBookings();
    await page.goto(`/${OWNER_A.slug}`);
    await page.locator(`a[href*="/${OWNER_A.slug}/reservar?servicio="]`, { hasText: "Corte de cabello" }).click();
    await pickSlot(page);
    await fillClient(page);
    await expect(page.getByLabel(/Autorizo expresamente/)).toHaveCount(0);
    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await page.waitForURL(/\/cita\//);
    const [row] = await withDb((sql) => sql<{ version: string | null; at: Date | null }[]>`
      select a.privacy_notice_version as version, a.health_consent_at as at from appointments a join businesses b on b.id = a.business_id where b.slug = ${OWNER_A.slug}`);
    expect(row).toEqual({ version: LEGAL_VERSION, at: null });
  });

  test("a business without address or contact does not take online bookings and the owner is told what to complete", async ({ page }) => {
    const id = stamp();
    const spec = { email: `incompleto-${id}@e2e.test`, name: "Dueño Incompleto", business: `Incompleto ${id}`, slug: `incompleto-${id}`, mode: "auto" as const, address: false as const, whatsapp: false as const, services: [{ name: "Corte", minutes: 30, priceCents: 10000, buffer: 0 }] };
    await seedTemp(spec);

    await page.goto(`/${spec.slug}`);
    await expect(page.getByText("todavía no recibe reservas en línea")).toBeVisible();
    await expect(page.getByRole("link", { name: "Agendar cita" })).toHaveCount(0);
    await expect(page.locator(`a[href*="/${spec.slug}/reservar"]`)).toHaveCount(0);
    // A direct visit to the booking page goes back to the profile.
    await page.goto(`/${spec.slug}/reservar`);
    await expect(page).toHaveURL(new RegExp(`/${spec.slug}$`));

    await signIn(page, spec);
    await page.goto("/app");
    await expect(page.getByText("Completa tus datos para recibir reservas en línea")).toBeVisible();
    await expect(page.getByText(/el domicilio del negocio .* y un teléfono o WhatsApp/)).toBeVisible();
    await page.getByRole("link", { name: "Completar datos" }).click();
    await expect(page).toHaveURL(/\/app\/perfil\/informacion/);
  });
});

test.describe("owner acceptance of a new version", () => {
  test("an owner on an older version sees the gate, accepts, and gets the panel; refusing can delete the account", async ({ page }) => {
    const id = stamp();
    const spec = { email: `vieja-${id}@e2e.test`, name: "Dueña Versión Vieja", business: `Negocio Viejo ${id}`, slug: `negocio-viejo-${id}`, mode: "auto" as const, services: [{ name: "Corte", minutes: 30, priceCents: 10000, buffer: 0 }] };
    await seedTemp(spec);
    await withDb((sql) => sql`update "user" set terms_version = '0.0-vieja' where email = ${spec.email}`);

    await signIn(page, spec);
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1, name: "Actualizamos nuestros términos y aviso de privacidad" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
    await noHorizontalScroll(page);

    // The box is required.
    await hydrated(page, 'button[type="submit"]');
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Marca la casilla para continuar.")).toBeVisible();

    await page.getByLabel(/He leído y acepto/).check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();

    const [row] = await withDb((sql) => sql<{ version: string; at: Date }[]>`select terms_version as version, terms_accepted_at as at from "user" where email = ${spec.email}`);
    expect(row!.version).toBe(LEGAL_VERSION);
    expect(Date.now() - new Date(row!.at).getTime()).toBeLessThan(60_000);
  });

  test("refusing is possible: the gate offers to delete the account", async ({ page }) => {
    const id = stamp();
    const spec = { email: `rechaza-${id}@e2e.test`, name: "Dueña Rechaza", business: `Negocio Rechaza ${id}`, slug: `negocio-rechaza-${id}`, mode: "auto" as const, services: [{ name: "Corte", minutes: 30, priceCents: 10000, buffer: 0 }] };
    await seedTemp(spec);
    await withDb((sql) => sql`update "user" set terms_version = null where email = ${spec.email}`);

    await signIn(page, spec);
    await page.goto("/app");
    await hydrated(page, "summary");
    await page.getByText("¿No estás de acuerdo?").click();
    await page.getByLabel(/Para confirmar, escribe/).fill(spec.business);
    await page.getByRole("button", { name: "Eliminar mi cuenta para siempre" }).click();
    await page.waitForURL(/\/login/);
    const left = await withDb((sql) => sql<{ n: number }[]>`select count(*)::int as n from "user" where email = ${spec.email}`);
    expect(left[0]!.n).toBe(0);
  });
});

test.describe("an owner who never finished onboarding", () => {
  test("can delete the account from the setup screen", async ({ page }) => {
    const email = `sin-negocio-${stamp()}@e2e.test`;
    const response = await page.request.post("/api/auth/sign-up/email", { data: { name: "Sin Negocio", email, password: PASSWORD, termsVersion: LEGAL_VERSION }, headers: { origin: "http://localhost:3100" } });
    expect(response.ok()).toBe(true);
    created.push(email);
    await withDb((sql) => sql`update "user" set email_verified = true where email = ${email}`);

    await signIn(page, { email });
    await page.goto("/app");
    await page.waitForURL(/\/app\/onboarding/);
    await page.getByRole("link", { name: "Eliminar mi cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/cuenta$/);
    await expect(page.getByText("todavía no habías terminado de configurar un negocio", { exact: false })).toBeVisible();
    await noHorizontalScroll(page);
    await hydrated(page, 'button[type="submit"]');
    await page.getByLabel(/Para confirmar, escribe/).fill(email);
    await page.getByRole("button", { name: "Eliminar mi cuenta para siempre" }).click();
    await page.waitForURL(/\/login/);
    const left = await withDb((sql) => sql<{ n: number }[]>`select count(*)::int as n from "user" where email = ${email}`);
    expect(left[0]!.n).toBe(0);
  });
});
