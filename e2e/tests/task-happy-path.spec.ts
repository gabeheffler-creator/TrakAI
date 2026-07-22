/**
 * E2E — Happy path: coach assigns task → client accepts → client marks complete.
 *
 * Uses real Chromium browser (via REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE).
 * Two browser contexts share the same Chromium process but have isolated cookies.
 *
 * Client: alex / alex (clientId 82)
 */
import { test, expect, type Browser } from "@playwright/test";
import { loginCoach, loginClient } from "./helpers/login";

const COACH_MESSAGES_URL = "/messages/82";
const TASK_TEXT = `E2E happy-path ${Date.now()}`;

async function makePage(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test.describe("Task happy path", () => {
  test(
    "coach assigns task via UI → client accepts → client marks complete on dashboard",
    async ({ browser }) => {
      const { ctx: coachCtx, page: coachPage } = await makePage(browser);
      const { ctx: clientCtx, page: clientPage } = await makePage(browser);

      try {
        // ── Step 1: Coach logs in and assigns task ────────────────────────────
        await loginCoach(coachPage);
        await coachPage.goto(COACH_MESSAGES_URL);

        await coachPage.waitForSelector('[data-testid="button-assign-task"]');
        await coachPage.click('[data-testid="button-assign-task"]');

        await coachPage.waitForSelector('[data-testid="dialog-assign-task-textarea"]');
        await coachPage.fill('[data-testid="dialog-assign-task-textarea"]', TASK_TEXT);
        await coachPage.click('[data-testid="button-dialog-assign"]');

        // Coach thread: wait for the task card text to appear
        await expect(coachPage.locator(`text="${TASK_TEXT}"`).first()).toBeVisible({
          timeout: 15_000,
        });

        // ── Step 2: Client logs in, finds the task card, and accepts ──────────
        await loginClient(clientPage, "alex");
        await clientPage.goto("/client/messages");

        // Scope to the message card wrapper that contains our specific task text
        const taskMsgCard = clientPage
          .locator('[data-testid^="msg-"]')
          .filter({ hasText: TASK_TEXT });
        await expect(taskMsgCard).toBeVisible({ timeout: 15_000 });

        // Accept / Reject buttons are inside this card
        const acceptBtn = taskMsgCard.locator('[data-testid="button-accept-task"]');
        await expect(acceptBtn).toBeVisible();

        await acceptBtn.click();

        // Accept/Reject buttons disappear; accepted label appears in the card
        await expect(acceptBtn).not.toBeVisible({ timeout: 10_000 });
        await expect(
          taskMsgCard.locator("text=Accepted — check your home screen")
        ).toBeVisible();

        // ── Step 3: Client checks dashboard — active task card visible ─────────
        await clientPage.goto("/client/");
        const taskCard = clientPage.locator('[data-testid="card-active-task"]');
        await expect(taskCard).toBeVisible({ timeout: 15_000 });
        await expect(taskCard.locator(`text="${TASK_TEXT}"`)).toBeVisible();

        // ── Step 4: Client marks task complete ────────────────────────────────
        await clientPage.click('[data-testid="button-mark-complete"]');

        // Our specific task text should no longer appear in the active task card
        // (another task from a prior run may still be active — that's OK)
        await expect(taskCard.locator(`text="${TASK_TEXT}"`)).not.toBeVisible({
          timeout: 15_000,
        });

        // ── Step 5: Coach sees completed state in thread ──────────────────────
        await coachPage.reload();
        await expect(
          coachPage.locator(`text="${TASK_TEXT}"`).locator("..").locator("text=Completed").first()
        ).toBeVisible({ timeout: 15_000 });
      } finally {
        await coachCtx.close();
        await clientCtx.close();
      }
    }
  );
});
