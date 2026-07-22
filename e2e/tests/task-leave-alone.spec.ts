/**
 * E2E — Coach leaves a rejected task alone.
 *
 * Uses real Chromium browser (via REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE).
 * Two browser contexts share the same Chromium process but have isolated cookies.
 *
 * Client: jordan / jordan (clientId 84)
 */
import { test, expect, type Browser } from "@playwright/test";
import { loginCoach, loginClient } from "./helpers/login";

const COACH_MESSAGES_URL = "/messages/84";
const TASK_TEXT = `E2E leave-alone ${Date.now()}`;

async function makePage(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test.describe("Task leave it alone", () => {
  test(
    "client rejects → coach leaves it alone → coach UI confirms → client has no active task",
    async ({ browser }) => {
      const { ctx: coachCtx, page: coachPage } = await makePage(browser);
      const { ctx: clientCtx, page: clientPage } = await makePage(browser);

      try {
        // ── Step 1: Coach assigns task via UI ────────────────────────────────
        await loginCoach(coachPage);
        await coachPage.goto(COACH_MESSAGES_URL);

        await coachPage.waitForSelector('[data-testid="button-assign-task"]');
        await coachPage.click('[data-testid="button-assign-task"]');

        await coachPage.waitForSelector('[data-testid="dialog-assign-task-textarea"]');
        await coachPage.fill('[data-testid="dialog-assign-task-textarea"]', TASK_TEXT);
        await coachPage.click('[data-testid="button-dialog-assign"]');

        await expect(coachPage.locator(`text="${TASK_TEXT}"`).first()).toBeVisible({
          timeout: 15_000,
        });

        // ── Step 2: Client rejects the task ──────────────────────────────────
        await loginClient(clientPage, "jordan");
        await clientPage.goto("/client/messages");

        const taskMsgCard = clientPage
          .locator('[data-testid^="msg-"]')
          .filter({ hasText: TASK_TEXT });
        await expect(taskMsgCard).toBeVisible({ timeout: 15_000 });

        const rejectBtn = taskMsgCard.locator('[data-testid="button-reject-task"]');
        await expect(rejectBtn).toBeVisible();

        await rejectBtn.click();
        await clientPage.waitForSelector('[data-testid="dialog-reject-reason"]');
        await clientPage.fill(
          '[data-testid="dialog-reject-reason"]',
          "Can't do this right now"
        );
        await clientPage.click('[data-testid="button-dialog-send-rejection"]');

        await expect(rejectBtn).not.toBeVisible({ timeout: 10_000 });

        // ── Step 3: Coach reloads and clicks "Leave It Alone" ─────────────────
        await coachPage.reload();

        // Only the current task's rejection card has canAct=true buttons
        const leaveAloneBtn = coachPage.locator('[data-testid="button-leave-alone"]').first();
        await expect(leaveAloneBtn).toBeVisible({ timeout: 15_000 });

        // Suggest button is also present before choosing leave-alone
        await expect(
          coachPage.locator('[data-testid="button-suggest-alternative"]').first()
        ).toBeVisible();

        await leaveAloneBtn.click();

        // ── Step 4: Coach UI confirms the "left alone" state ──────────────────
        // Action buttons disappear
        await expect(leaveAloneBtn).not.toBeVisible({ timeout: 10_000 });
        await expect(
          coachPage.locator('[data-testid="button-suggest-alternative"]').first()
        ).not.toBeVisible();

        // "Left alone" confirmation text appears (may match multiple old runs; use first)
        await expect(
          coachPage.locator("text=You left this alone.").first()
        ).toBeVisible();

        // ── Step 5: Client reloads — sees "coach left this one alone" ─────────
        await clientPage.reload();

        // The task message card still shows the task text
        const taskMsgCardReloaded = clientPage
          .locator('[data-testid^="msg-"]')
          .filter({ hasText: TASK_TEXT });
        await expect(taskMsgCardReloaded).toBeVisible({ timeout: 15_000 });

        // ── Step 6: Client dashboard has no active task card ──────────────────
        await clientPage.goto("/client/");
        const taskCard = clientPage.locator('[data-testid="card-active-task"]');
        await expect(taskCard).not.toBeVisible({ timeout: 10_000 });
      } finally {
        await coachCtx.close();
        await clientCtx.close();
      }
    }
  );
});
