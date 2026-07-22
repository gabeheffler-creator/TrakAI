/**
 * E2E: Happy path — coach assigns task, client accepts, client marks complete.
 *
 * Uses Playwright APIRequestContext (no browser binary required).
 * Tests the full server-side lifecycle against the running dev server.
 *
 * Demo credentials: coach/coach  |  alex/alex (client id 82)
 */
import { test, expect } from "@playwright/test";

const CLIENT_ID = 82;

async function coachLogin(request: Parameters<Parameters<typeof test>[1]>[0]["request"]) {
  const res = await request.post("/api/auth/coach/login", {
    data: { username: "coach", password: "coach" },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
}

async function clientLogin(request: Parameters<Parameters<typeof test>[1]>[0]["request"]) {
  const res = await request.post("/api/auth/client/login", {
    data: { username: "alex", password: "alex" },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.ok).toBe(true);
}

test.describe("Task happy path", () => {
  test("coach assigns → client accepts → client marks complete", async ({ request }) => {
    const taskText = `E2E happy ${Date.now()}`;

    // ── Coach: log in ─────────────────────────────────────────────────────────
    await coachLogin(request);

    // ── Coach: assign task ────────────────────────────────────────────────────
    const assignRes = await request.post(`/api/clients/${CLIENT_ID}/tasks`, {
      data: { text: taskText },
    });
    expect(assignRes.ok()).toBe(true);
    const task = await assignRes.json();
    expect(task.id).toBeDefined();
    expect(task.status).toBe("pending");
    expect(task.text).toBe(taskText);

    // ── Coach: verify task appears in the message thread ──────────────────────
    const messagesRes = await request.get(`/api/clients/${CLIENT_ID}/messages`);
    expect(messagesRes.ok()).toBe(true);
    const messages: any[] = await messagesRes.json();
    const taskMsg = messages.find(
      (m) => m.messageType === "task_assigned" && m.taskId === task.id,
    );
    expect(taskMsg).toBeDefined();
    expect(taskMsg.content).toBe(taskText);
    expect(taskMsg.sender).toBe("coach");

    // ── Client: log in ────────────────────────────────────────────────────────
    // (Same context — log in as client; session is replaced)
    await clientLogin(request);

    // ── Client: accept task ───────────────────────────────────────────────────
    const acceptRes = await request.patch(
      `/api/clients/${CLIENT_ID}/tasks/${task.id}/accept`,
    );
    expect(acceptRes.ok()).toBe(true);
    const accepted = await acceptRes.json();
    expect(accepted.status).toBe("accepted");

    // ── Client: verify active task appears on dashboard endpoint ──────────────
    const activeRes = await request.get(`/api/clients/${CLIENT_ID}/tasks/active`);
    expect(activeRes.ok()).toBe(true);
    const activeTask = await activeRes.json();
    expect(activeTask).not.toBeNull();
    expect(activeTask.id).toBe(task.id);
    expect(activeTask.status).toBe("accepted");

    // ── Client: mark complete ─────────────────────────────────────────────────
    const completeRes = await request.patch(
      `/api/clients/${CLIENT_ID}/tasks/${task.id}/complete`,
    );
    expect(completeRes.ok()).toBe(true);
    const completed = await completeRes.json();
    expect(completed.status).toBe("completed");

    // ── Verify: no active task remains ───────────────────────────────────────
    const afterRes = await request.get(`/api/clients/${CLIENT_ID}/tasks/active`);
    expect(afterRes.ok()).toBe(true);
    const afterActive = await afterRes.json();
    // Should be null or a different task (not the one we just completed)
    expect(afterActive?.id ?? null).not.toBe(task.id);

    // ── Verify: completion message appears in thread ──────────────────────────
    const finalMessages = await (await request.get(`/api/clients/${CLIENT_ID}/messages`)).json() as any[];
    const completeMsg = finalMessages.find(
      (m) => m.content === "Task completed ✓" && m.taskId === task.id,
    );
    expect(completeMsg).toBeDefined();
  });
});
