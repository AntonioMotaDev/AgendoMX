import { expect, type Page } from "@playwright/test";
import { OWNER_A, PASSWORD } from "./fixtures";

/** Waits until React has attached to the element: before that, clicks do nothing in `next dev`. */
export async function hydrated(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((key) => key.startsWith("__reactProps") || key.startsWith("__reactFiber"));
  }, selector);
}

/** Signs in through the API (fast, and keeps most tests independent from the login form). */
export async function signIn(page: Page, owner: { email: string } = OWNER_A) {
  const origin = new URL(page.url() === "about:blank" ? "http://localhost:3100" : page.url()).origin;
  const response = await page.request.post("/api/auth/sign-in/email", { data: { email: owner.email, password: PASSWORD }, headers: { origin } });
  expect(response.ok(), `sign-in ${owner.email}`).toBe(true);
}

export async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

export const UNIQUE_PHONE = () => `55 ${String(1000 + Math.floor(Math.random() * 8999))} ${String(1000 + Math.floor(Math.random() * 8999))}`;

/** Day radios of the booking calendar. Only days with open times are radios. */
const dayRadios = (page: Page) => page.getByRole("radiogroup", { name: "Día" }).getByRole("radio");

/** The calendar shows one month at a time: moves forward until `visible` is true (at most two months). */
async function goToMonthWhere(page: Page, visible: () => Promise<boolean>) {
  await dayRadios(page).first().waitFor();
  for (let i = 0; i < 2 && !(await visible()); i++) await page.getByRole("button", { name: "Mes siguiente" }).click();
}

/** Selects a day of the booking calendar by its full label ("Jueves 3 de diciembre de 2026"), moving to the next month if needed. */
export async function chooseDay(page: Page, label: string) {
  const radio = page.getByRole("radio", { name: label });
  await goToMonthWhere(page, () => radio.isVisible());
  await radio.click();
}

/**
 * Walks the booking wizard to the details step: third available day (so "today's lead time"
 * never matters) and its first free time. Returns the chosen slot's label.
 */
export async function pickSlot(page: Page, { dayIndex = 2, timeIndex = 0 } = {}) {
  const days = dayRadios(page);
  // Near the end of a month fewer days are left in view: continue in the next one.
  await goToMonthWhere(page, async () => (await days.count()) > dayIndex);
  await days.nth(dayIndex).click();
  const times = page.getByRole("radiogroup", { name: "Hora" }).getByRole("radio");
  const label = (await times.nth(timeIndex).innerText()).trim();
  await times.nth(timeIndex).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  return label;
}

export async function fillClient(page: Page, input: { name?: string; phone?: string; email?: string } = {}) {
  await page.getByLabel("Tu nombre").fill(input.name ?? "Cliente E2E");
  await page.getByLabel("Tu celular").fill(input.phone ?? UNIQUE_PHONE());
  if (input.email) await page.getByLabel("Correo (opcional)").fill(input.email);
}
