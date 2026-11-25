import { expect, test } from "@playwright/test";
import { OWNER_A } from "./support/fixtures";
import { noHorizontalScroll } from "./support/helpers";
import { withDb } from "./support/db";

test("the app serves the seeded business from the E2E database", async ({ page }) => {
  await page.goto(`/${OWNER_A.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: OWNER_A.business })).toBeVisible();
  await expect(page.getByText("Corte de cabello")).toBeVisible();
  await noHorizontalScroll(page);
  // The page came from the disposable database, not from development data.
  const [{ n }] = await withDb((sql) => sql<{ n: number }[]>`select count(*)::int as n from businesses`);
  expect(n).toBe(2);
});
