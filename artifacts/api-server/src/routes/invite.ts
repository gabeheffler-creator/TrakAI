import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router = Router();

router.post("/invite/send-email", async (req, res) => {
  const { email, name, inviteUrl } = req.body as {
    clientId?: number;
    email?: string;
    name?: string;
    inviteUrl?: string;
  };

  if (!email || !name || !inviteUrl) {
    res.status(400).json({ error: "email, name and inviteUrl are required" });
    return;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 8px;">You've been invited to TrakAI 🎉</h2>
      <p style="color: #555; margin: 0 0 24px;">Hi ${name}, your coach has set up a TrakAI account for you. Click the button below to get started.</p>
      <a href="${inviteUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Accept Invite</a>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">If you didn't expect this email, you can safely ignore it.</p>
    </div>
  `;

  const rawMessage = [
    `To: ${email}`,
    `Subject: You have been invited to TrakAI`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
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
      `/gmail/v1/users/me/messages/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      req.log.error({ status: response.status, body: errBody }, "Gmail invite API error");
      res.status(500).json({ error: "Failed to send invite email" });
      return;
    }

    req.log.info({ email, name }, "Invite email sent");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send invite email");
    res.status(500).json({ error: "Failed to send invite email" });
  }
});

export default router;
