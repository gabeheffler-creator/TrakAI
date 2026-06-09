import { Router } from "express";
import { Resend } from "resend";
import { logger } from "../lib/logger";

const router = Router();

const TO_EMAIL = "gabe.heffler@gmail.com";

router.post("/feedback", async (req, res) => {
  const { type, content, from } = req.body as Record<string, unknown>;

  if (
    (type !== "bug" && type !== "feedback") ||
    typeof content !== "string" ||
    content.trim().length === 0 ||
    content.length > 5000 ||
    (from !== "coach" && from !== "client")
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    req.log.error("RESEND_API_KEY is not set — cannot send feedback email");
    res.status(503).json({ error: "Email service not configured" });
    return;
  }

  const resend = new Resend(apiKey);

  const label = type === "bug" ? "🐛 Bug report" : "💬 Feedback";
  const sender = from === "coach" ? "a coach" : "a client";
  const subject = `[TrakAI] ${label} from ${sender}`;
  const html = `
    <h2>${label} from ${sender}</h2>
    <pre style="font-family: sans-serif; white-space: pre-wrap; background: #f5f5f5; padding: 16px; border-radius: 8px;">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
  `;

  try {
    await resend.emails.send({
      from: "TrakAI <onboarding@resend.dev>",
      to: TO_EMAIL,
      subject,
      html,
    });
    req.log.info({ type, from }, "Feedback email sent");
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send feedback email");
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
