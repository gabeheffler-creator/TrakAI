import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router = Router();

const TO_EMAIL = "gabe.heffler@gmail.com";

interface SurveyResponse {
  name: string;
  email: string;
  role: string;
  clientCount: string;
  currentTools: string;
  painPoints: string;
  mostValuableFeature: string;
  betaInterest: string;
}

router.post("/survey-response", async (req, res) => {
  const body = req.body as Partial<SurveyResponse>;

  if (!body.name || !body.email || !body.role) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const rows = [
    ["Name", body.name],
    ["Email", body.email],
    ["Role", body.role],
    ["Client count", body.clientCount ?? "—"],
    ["Current tools", body.currentTools ?? "—"],
    ["Pain points", body.painPoints ?? "—"],
    ["Most valuable feature", body.mostValuableFeature ?? "—"],
    ["Beta interest", body.betaInterest ?? "—"],
  ];

  const textBody = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const htmlBody = `
    <h2 style="font-family:sans-serif;margin-bottom:16px">TrakAI Beta Survey Response</h2>
    <table style="font-family:sans-serif;border-collapse:collapse;width:100%;max-width:560px">
      ${rows.map(([k, v]) => `
        <tr>
          <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:40%;vertical-align:top">${k}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;vertical-align:top">${String(v).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
        </tr>`).join("")}
    </table>
  `;

  const rawMessage = [
    `To: ${TO_EMAIL}`,
    `Subject: [TrakAI] Beta survey response from ${body.name}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
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
      req.log.error({ status: response.status, body: errBody }, "Gmail API error sending survey");
      res.status(500).json({ error: "Failed to send response" });
      return;
    }

    req.log.info({ name: body.name, email: body.email }, "Survey response sent");
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send survey response email");
    res.status(500).json({ error: "Failed to send response" });
  }
});

export default router;
