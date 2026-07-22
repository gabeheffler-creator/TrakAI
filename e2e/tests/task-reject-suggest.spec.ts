/**
 * E2E: Rejection path — client rejects, coach suggests alternative, client accepts.
 *
 * Uses Playwright APIRequestContext (no browser binary required).
 * Tests the full server-side lifecycle against the running dev server.
 *
 * Demo credentials: coach/coach  |  sam/sam (client id 83)
 */
import { test, expect } from "@playwright/test";

const CLIENT_ID = 83;

test.describe("Task rejection → suggest alternative", () => {
  test("client rejects → coach suggests alternative → client accepts alternative", async ({
    request,
  }) => {
    const taskText = `E2E reject ${Date.now()}`;
    const altText = "Walk 10 minutes each morning instead";
    const rejectReason = "I can't do this because of my schedule";

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

    // ── Verify: task_assigned message in thread ───────────────────────────────
    const messagesAfterAssign: any[] = await (
      await request.get(`/api/clients/${CLIENT_ID}/messages`)
    ).json();
    const assignedMsg = messagesAfterAssign.find(
      (m) => m.messageType === "task_assigned" && m.taskId === task.id,
    );
    expect(assignedMsg).toBeDefined();

    // ── Client: log in and reject ─────────────────────────────────────────────
    const clientLoginRes = await request.post("/api/auth/client/login", {
      data: { username: "sam", password: "sam" },
    });
    expect(clientLoginRes.ok()).toBe(true);

    const rejectRes = await request.patch(
      `/api/clients/${CLIENT_ID}/tasks/${task.id}/reject`,
      { data: { reason: rejectReason } },
    );
    expect(rejectRes.ok()).toBe(true);
    const rejected = await rejectRes.json();
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe(rejectReason);
    expect(rejected.altStatus).toBeNull();

    // ── Verify: task_rejected message in thread ───────────────────────────────
    const messagesAfterReject: any[] = await (
      await request.get(`/api/clients/${CLIENT_ID}/messages`)
    ).json();
    const rejectedMsg = messagesAfterReject.find(
      (m) => m.messageType === "task_rejected" && m.taskId === task.id,
    );
    expect(rejectedMsg).toBeDefined();
    expect(rejectedMsg.content).toBe(rejectReason);
    expect(rejectedMsg.sender).toBe("client");

    // ── Coach: log in and suggest alternative ─────────────────────────────────
    const coachLoginRes2 = await request.post("/api/auth/coach/login", {
      data: { username: "coach", password: "coach" },
    });
    expect(coachLoginRes2.ok()).toBe(true);

    const suggestRes = await request.patch(
      `/api/clients/${CLIENT_ID}/tasks/${task.id}/suggest`,
      { data: { alternativeText: altText } },
    );
    expect(suggestRes.ok()).toBe(true);
    const suggested = await suggestRes.json();
    expect(suggested.altStatus).toBe("pending");
    expect(suggested.alternativeText).toBe(altText);

    // ── Verify: task_alternative message in thread ────────────────────────────
    const messagesAfterSuggest: any[] = await (
      await request.get(`/api/clients/${CLIENT_ID}/messages`)
    ).json();
    const altMsg = messagesAfterSuggest.find(
      (m) => m.messageType === "task_alternative" && m.taskId === task.id,
    );
    expect(altMsg).toBeDefined();
    expect(altMsg.content).toBe(altText);
    expect(altMsg.sender).toBe("coach");

    // ── Client: log in and accept alternative ────────────────────────────────
    const clientLoginRes2 = await request.post("/api/auth/client/login", {
      data: { username: "sam", password: "sam" },
    });
    expect(clientLoginRes2.ok()).toBe(true);

    const acceptRes = await request.patch(
      `/api/clients/${CLIENT_ID}/tasks/${task.id}/accept`,
    );
    expect(acceptRes.ok()).toBe(true);
    const altAccepted = await acceptRes.json();
    expect(altAccepted.status).toBe("accepted");
    expect(altAccepted.altStatus).toBe("accepted");

    // ── Verify: active task shows alternative text on dashboard ──────────────
    const activeRes = await request.get(
      `/api/clients/${CLIENT_ID}/tasks/active`,
    );
    expect(activeRes.ok()).toBe(true);
    const activeTask = await activeRes.json();
    expect(activeTask).not.toBeNull();
    expect(activeTask.id).toBe(task.id);
    // altStatus=accepted means dashboard should show alternativeText
    expect(activeTask.altStatus).toBe("accepted");
    expect(activeTask.alternativeText).toBe(altText);
  });
});
