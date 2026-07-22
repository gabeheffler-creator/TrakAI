import type { Page } from "@playwright/test";

export async function loginCoach(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill("#username", "coach");
  await page.fill("#password", "coach");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 15_000,
  });
}

export async function loginClient(
  page: Page,
  username: string
): Promise<void> {
  await page.goto("/client/login");
  await page.fill("#username", username);
  await page.fill("#password", username);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 15_000,
  });
}
