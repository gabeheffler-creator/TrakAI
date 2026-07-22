/**
 * E2E — Rejection → suggest alternative → client accepts alternative.
 *
 * Uses real Chromium browser (via REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE).
 * Two browser contexts share the same Chromium process but have isolated cookies.
 *
 * Client: sam / sam (clientId 83)
 */
import { test, expect, type Browser } from "@playwright/test";
import { loginCoach, loginClient } from "./helpers/login";

const COACH_MESSAGES_URL = "/messages/83";
const TASK_TEXT = `E2E reject-suggest ${Date.now()}`;
const ALT_TEXT = `E2E alternative ${Date.now()}`;

async function makePage(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test.describe("Task rejection → suggest alternative", () => {
  test(
    "client rejects → coach suggests alternative → client accepts alternative → dashboard shows alt text",
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

        // Coach sees task card in thread
        await expect(coachPage.locator(`text="${TASK_TEXT}"`).first()).toBeVisible({
          timeout: 15_000,
        });

        // ── Step 2: Client logs in and rejects the task ───────────────────────
        await loginClient(clientPage, "sam");
        await clientPage.goto("/client/messages");

        // Scope to the message card wrapper containing our task text
        const taskMsgCard = clientPage
          .locator('[data-testid^="msg-"]')
          .filter({ hasText: TASK_TEXT });
        await expect(taskMsgCard).toBeVisible({ timeout: 15_000 });

        const rejectBtn = taskMsgCard.locator('[data-testid="button-reject-task"]');
        await expect(rejectBtn).toBeVisible();

        await rejectBtn.click();

        // Rejection dialog opens
        await clientPage.waitForSelector('[data-testid="dialog-reject-reason"]');
        await clientPage.fill(
          '[data-testid="dialog-reject-reason"]',
          "This task doesn't fit my schedule"
        );
        await clientPage.click('[data-testid="button-dialog-send-rejection"]');

        // Dialog closes; rejected label appears; action buttons gone
        await expect(
          clientPage.locator('[data-testid="dialog-reject-reason"]')
        ).not.toBeVisible({ timeout: 10_000 });
        await expect(rejectBtn).not.toBeVisible();

        // ── Step 3: Coach reloads and sees the rejection card ────────────────
        await coachPage.reload();

        // Only the current task's rejection card has canAct=true (only one set of buttons)
        const suggestBtn = coachPage.locator('[data-testid="button-suggest-alternative"]').first();
        await expect(suggestBtn).toBeVisible({ timeout: 15_000 });
        await expect(
          coachPage.locator('[data-testid="button-leave-alone"]').first()
        ).toBeVisible();

        // ── Step 4: Coach opens suggest dialog and submits alternative ────────
        await suggestBtn.click();
        await coachPage.waitForSelector('[data-testid="dialog-suggest-textarea"]');
        await coachPage.fill('[data-testid="dialog-suggest-textarea"]', ALT_TEXT);
        await coachPage.click('[data-testid="button-dialog-suggest"]');

        // Suggest / Leave buttons disappear; status label appears
        await expect(suggestBtn).not.toBeVisible({ timeout: 10_000 });
        await expect(
          coachPage.locator("text=Alternative suggested.").first()
        ).toBeVisible();

        // ── Step 5: Client sees alternative task card and accepts it ──────────
        await clientPage.reload();

        // Alternative card has data-testid="msg-{id}" and contains ALT_TEXT
        const altMsgCard = clientPage
          .locator('[data-testid^="msg-"]')
          .filter({ hasText: ALT_TEXT });
        await expect(altMsgCard).toBeVisible({ timeout: 15_000 });

        const acceptAltBtn = altMsgCard.locator('[data-testid="button-accept-task"]');
        await expect(acceptAltBtn).toBeVisible();

        await acceptAltBtn.click();

        await expect(acceptAltBtn).not.toBeVisible({ timeout: 10_000 });
        await expect(
          altMsgCard.locator("text=Accepted — check your home screen")
        ).toBeVisible();

        // ── Step 6: Dashboard shows alternativeText (not original task text) ──
        await clientPage.goto("/client/");
        const taskCard = clientPage.locator('[data-testid="card-active-task"]');
        await expect(taskCard).toBeVisible({ timeout: 15_000 });

        // Alternative text displayed, not the original
        await expect(taskCard.locator(`text="${ALT_TEXT}"`)).toBeVisible();
        await expect(taskCard.locator(`text="${TASK_TEXT}"`)).not.toBeVisible();
      } finally {
        await coachCtx.close();
        await clientCtx.close();
      }
    }
  );
});
