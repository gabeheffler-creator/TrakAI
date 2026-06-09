import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "../lib/logger";

const router = Router();

const TO_EMAIL = "gabe.heffler@gmail.com";
const FROM_EMAIL = "me";

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

  const label = type === "bug" ? "🐛 Bug report" : "💬 Feedback";
  const sender = from === "coach" ? "a coach" : "a client";
  const subject = `[TrakAI] ${label} from ${sender}`;

  const bodyText = `${label} from ${sender}\n\n${content}`;
  const rawMessage = [
    `To: ${TO_EMAIL}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    bodyText,
  ].join("\r\n");

  const encoded = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy(
      "google-mail",
      `/gmail/v1/users/${FROM_EMAIL}/messages/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      req.log.error({ status: response.status, body: errBody }, "Gmail API error");
      res.status(500).json({ error: "Failed to send email" });
      return;
    }

    req.log.info({ type, from }, "Feedback email sent via Gmail");
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send feedback email");
    res.status(500).json({ error: "Failed to send email" });
  }
});

export default router;
