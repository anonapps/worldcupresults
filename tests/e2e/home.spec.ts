import { test, expect } from "@playwright/test";

test("homepage placeholder", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "World Cup Simulator 2026" })).toBeVisible();
});
