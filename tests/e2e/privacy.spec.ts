import { expect, test } from "@playwright/test";
import { appointmentsOf, resetBookings, seedAppointment, withDb } from "./support/db";
import { OWNER_A, PASSWORD } from "./support/fixtures";
import { hydrated, noHorizontalScroll, signIn } from "./support/helpers";
import { seedOwner } from "./support/seed";

test.beforeEach(async () => {
  await resetBookings();
});

test.describe("owner controls over personal data", () => {
  test("Perfil links to the clients list and to the account page", async ({ page }) => {
    await signIn(page);
    await page.goto("/app/perfil");
    await expect(page.getByRole("link", { name: /Tus clientes/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mi cuenta/ })).toBeVisible();
  });

  test("erasing a client keeps their appointments without personal data and kills the links already sent", async ({ page, browser }) => {
    const past = await seedAppointment({ slug: OWNER_A.slug, status: "completed", startsInHours: -72, clientName: "Elena Borrar", phone: "+525512340301" });
    await seedAppointment({ slug: OWNER_A.slug, status: "confirmed", startsInHours: 30, clientName: "Fabio Pendiente", phone: "+525512340302" });
    await signIn(page);
    await page.goto("/app/perfil/clientes");

    await expect(page.getByText("Elena Borrar")).toBeVisible();
    await expect(page.getByText("Fabio Pendiente")).toBeVisible();
    await noHorizontalScroll(page);
    // A client with a coming appointment cannot be erased yet.
    const fabio = page.getByRole("listitem").filter({ hasText: "Fabio Pendiente" });
    await expect(fabio.getByText(/Tiene 1 cita próxima/)).toBeVisible();
    await expect(fabio.getByRole("button", { name: "Borrar sus datos" })).toHaveCount(0);

    // Erase the other one: asked first, "No" keeps everything.
    const elena = page.getByRole("listitem").filter({ hasText: "Elena Borrar" });
    await hydrated(page, "button");
    await elena.getByRole("button", { name: "Borrar sus datos" }).click();
    await expect(page.getByText("¿Borrar los datos de Elena Borrar?")).toBeVisible();
    await page.getByRole("button", { name: "No", exact: true }).click();
    await expect(page.getByText("Elena Borrar")).toBeVisible();

    await elena.getByRole("button", { name: "Borrar sus datos" }).click();
    await page.getByRole("button", { name: "Sí, borrar sus datos" }).click();
    await expect(page.getByText("Elena Borrar")).toHaveCount(0);
    await expect(page.getByText("+525512340301")).toHaveCount(0);

    const rows = await withDb((sql) => sql<{ name: string; phone: string; email: string | null }[]>`select name, phone, email from clients where id = (select client_id from appointments where id = ${past.id})`);
    expect(rows[0]).toMatchObject({ name: "Cliente eliminado", email: null });
    expect(rows[0]!.phone).toMatch(/^\+99\d{10}$/);
    expect((await appointmentsOf(OWNER_A.slug)).some((a) => a.id === past.id)).toBe(true); // the appointment itself stays

    // The link that was already sent no longer opens the appointment.
    const customer = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "es-MX" })).newPage();
    expect((await customer.goto(`/cita/${past.token}`))?.status()).toBe(404);
    await customer.context().close();
  });

  test("an owner can delete their whole account: the confirmation must match, and then everything is gone", async ({ page, browser }) => {
    const stamp = Date.now();
    const spec = {
      email: `borrar-${stamp}@e2e.test`,
      name: "Dueña Temporal",
      business: `Salón Temporal ${stamp}`,
      slug: `salon-temporal-${stamp}`,
      mode: "auto" as const,
      services: [{ name: "Peinado", minutes: 45, priceCents: 15000, buffer: 0 }],
    };
    await seedOwner(spec);
    const upcoming = await seedAppointment({ slug: spec.slug, status: "confirmed", startsInHours: 30, clientName: "Gina Futura", phone: "+525512340401" });
    await seedAppointment({ slug: spec.slug, status: "completed", startsInHours: -72, clientName: "Hugo Pasado", phone: "+525512340402" });
    // Another owner's data must survive.
    const survivingBefore = await withDb((sql) => sql<{ n: number }[]>`select count(*)::int as n from businesses where slug = ${OWNER_A.slug}`);

    await signIn(page, spec);
    await page.goto("/app/perfil/cuenta");
    await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
    await expect(page.getByText(`Tu negocio “${spec.business}”`, { exact: false })).toBeVisible();
    await expect(page.getByText("2 clientes y 2 citas registradas.")).toBeVisible();
    await expect(page.getByText(/Tienes 1 cita próxima activa\. Tus clientes NO serán avisados/)).toBeVisible();
    await noHorizontalScroll(page);

    await hydrated(page, "button");
    const submit = page.getByRole("button", { name: "Eliminar mi cuenta para siempre" });
    await expect(submit).toBeDisabled();
    await page.getByLabel(/Para confirmar, escribe/).fill("otro nombre");
    await submit.click();
    await expect(page.getByText("No coincide. Escríbelo igual que aparece para confirmar.")).toBeVisible();
    expect(await withDb((sql) => sql`select 1 from "user" where email = ${spec.email}`)).toHaveLength(1); // nothing happened

    await page.getByLabel(/Para confirmar, escribe/).fill(`  ${spec.business.toUpperCase()}  `);
    await submit.click();
    await page.waitForURL(/\/login\?eliminada=1/);
    await expect(page.getByText("Tu cuenta y tus datos fueron eliminados.")).toBeVisible();

    const left = await withDb((sql) => sql<{ users: number; businesses: number; clients: number; appointments: number }[]>`
      select (select count(*)::int from "user" where email = ${spec.email}) as users,
             (select count(*)::int from businesses where slug = ${spec.slug}) as businesses,
             (select count(*)::int from clients where phone in ('+525512340401','+525512340402')) as clients,
             (select count(*)::int from appointments where id = ${upcoming.id}) as appointments`);
    expect(left[0]).toEqual({ users: 0, businesses: 0, clients: 0, appointments: 0 });

    // Public traces are gone too: profile, customer link, and signing in.
    const visitor = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "es-MX" })).newPage();
    expect((await visitor.goto(`/${spec.slug}`))?.status()).toBe(404);
    expect((await visitor.goto(`/cita/${upcoming.token}`))?.status()).toBe(404);
    await visitor.context().close();
    const login = await page.request.post("/api/auth/sign-in/email", { data: { email: spec.email, password: PASSWORD }, headers: { origin: "http://localhost:3100" } });
    expect(login.ok()).toBe(false);

    const survivingAfter = await withDb((sql) => sql<{ n: number }[]>`select count(*)::int as n from businesses where slug = ${OWNER_A.slug}`);
    expect(survivingAfter[0]!.n).toBe(survivingBefore[0]!.n);
  });
});
