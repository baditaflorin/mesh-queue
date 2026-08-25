import { expect, test, type Page } from "@playwright/test";

async function closeInitiallyOpenSettings(page: Page): Promise<void> {
  const settings = page.getByRole("dialog", { name: "Settings" });
  if (!(await settings.isVisible().catch(() => false))) return;
  const close = settings.getByRole("button", { name: "close" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(settings).toBeHidden();
}

test("mobile service desk keeps the current place and next action in view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await closeInitiallyOpenSettings(page);

  const primaryAction = page.getByRole("button", { name: "Take a number" });
  await expect(page.getByRole("heading", { name: "A line that keeps moving." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready when you are" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Desk is ready" })).toBeVisible();
  await expect(primaryAction).toBeEnabled();

  const primaryActionBounds = await primaryAction.evaluate((element) => {
    const { bottom, top } = element.getBoundingClientRect();
    return { bottom, top, viewportHeight: window.innerHeight };
  });
  expect(primaryActionBounds.top).toBeGreaterThan(0);
  expect(primaryActionBounds.bottom).toBeLessThanOrEqual(primaryActionBounds.viewportHeight);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("short desktop keeps the primary service action in the first viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1141, height: 602 });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await closeInitiallyOpenSettings(page);

  const primaryAction = page.getByRole("button", { name: "Take a number" });
  await expect(page.getByRole("heading", { name: "A line that keeps moving." })).toBeVisible();
  await expect(primaryAction).toBeEnabled();

  const primaryActionBounds = await primaryAction.evaluate((element) => {
    const { bottom, top } = element.getBoundingClientRect();
    return { bottom, top, viewportHeight: window.innerHeight };
  });
  expect(primaryActionBounds.top).toBeGreaterThan(0);
  expect(primaryActionBounds.bottom).toBeLessThanOrEqual(primaryActionBounds.viewportHeight);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("a guest can take a number, run the desk, and call the next person", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await closeInitiallyOpenSettings(page);

  await page.getByLabel("Your name").fill("Ada");
  await page.getByRole("button", { name: "Take a number" }).click();
  await expect(page.getByRole("heading", { name: "Number 01" })).toBeVisible();

  await page.getByRole("button", { name: "Run the desk" }).first().click();
  const callNext = page.getByRole("button", { name: "Call the next guest" }).first();
  await expect(callNext).toBeEnabled();
  await callNext.click();

  await expect(page.getByRole("heading", { name: "You’re up" })).toBeVisible();
  await expect(page.getByText("At the desk").first()).toBeVisible();
});
