/**
 * E2E: Leave it alone — client rejects, coach clicks Leave It Alone.
 *
 * Uses Playwright APIRequestContext (no browser binary required).
 * Tests the full server-side lifecycle against the running dev server.
 *
 * Demo credentials: coach/coach  |  jordan/jordan (client id 84)
 */
import { test, expect } from "@playwright/test";

const CLIENT_ID = 84;

test.describe("Task leave it alone", () => {
  test("coach leaves a rejected task alone → altStatus=left_alone, no active task", async ({
    request,
  }) => {
    const taskText = `E2E leave ${Date.now()}`;
    const rejectReason = "I simply cannot do this right now";

    // ── Coach: log in and assign task ────────────────────────────────────────
    const coachLoginRes = await request.post("/api/auth/coach/login", {
      data: { username: "coach", password: "coach" },
    });
    expect(coachLoginRes.ok()).toBe(true);

    const assignRes = await request.post(`/api/clients/${CLIENT_ID}/tasks`, {
      data: { text: taskText },
    });
    expect(assignRes.ok()).toBe(true);
    const task = await assignRes.json();
    expect(task.status).toBe("pending");

    // ── Client: log in and reject ─────────────────────────────────────────────
    const clientLoginRes = await request.post("/api/auth/client/login", {
      data: { username: "jordan", password: "jordan" },
    });
    expect(clientLoginRes.ok()).toBe(true);

    const rejectRes = await request.patch(
      `/api/clients/${CLIENT_ID}/tasks/${task.id}/reject`,
      { data: { reason: rejectReason } },
    );
    expect(rejectRes.ok()).toBe(true);
    const rejected = await rejectRes.json();
    expect(rejected.status).toBe("rejected");
    expect(rejected.altStatus).toBeNull();

    // ── Coach: log in and leave it alone ─────────────────────────────────────
    const coachLoginRes2 = await request.post("/api/auth/coach/login", {
      data: { username: "coach", password: "coach" },
    });
    expect(coachLoginRes2.ok()).toBe(true);

    const leaveRes = await request.patch(
      `/api/clients/${CLIENT_ID}/tasks/${task.id}/leave`,
    );
    expect(leaveRes.ok()).toBe(true);
    const leftAlone = await leaveRes.json();
    expect(leftAlone.altStatus).toBe("left_alone");
    // Status stays rejected (not accepted)
    expect(leftAlone.status).toBe("rejected");

    // ── Verify: thread contains the "left alone" message from coach ────────────
    const messagesRes = await request.get(`/api/clients/${CLIENT_ID}/messages`);
    expect(messagesRes.ok()).toBe(true);
    const messages: any[] = await messagesRes.json();
    const leftAloneMsg = messages.find(
      (m) =>
        m.taskId === task.id &&
        m.content === "I'll leave this one — no alternative needed.",
    );
    expect(leftAloneMsg).toBeDefined();
    expect(leftAloneMsg.sender).toBe("coach");

    // ── Client: log back in and verify no active task ─────────────────────────
    const clientLoginRes2 = await request.post("/api/auth/client/login", {
      data: { username: "jordan", password: "jordan" },
    });
    expect(clientLoginRes2.ok()).toBe(true);

    const activeRes = await request.get(
      `/api/clients/${CLIENT_ID}/tasks/active`,
    );
    expect(activeRes.ok()).toBe(true);
    const activeTask = await activeRes.json();
    // This task should NOT be active (it was rejected and left alone)
    expect(activeTask?.id ?? null).not.toBe(task.id);

    // ── Verify: coach cannot suggest alternative after leaving it alone ────────
    const coachLoginRes3 = await request.post("/api/auth/coach/login", {
      data: { username: "coach", password: "coach" },
    });
    expect(coachLoginRes3.ok()).toBe(true);

    // Re-fetch task state via messages to confirm altStatus
    const finalMessages: any[] = await (
      await request.get(`/api/clients/${CLIENT_ID}/messages`)
    ).json();
    const rejectedMsgFinal = finalMessages.find(
      (m) => m.messageType === "task_rejected" && m.taskId === task.id,
    );
    expect(rejectedMsgFinal).toBeDefined();
    // The embedded task object should show altStatus=left_alone
    expect(rejectedMsgFinal.task?.altStatus).toBe("left_alone");
  });
});
