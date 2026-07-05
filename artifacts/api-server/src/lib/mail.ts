import { ReplitConnectors } from "@replit/connectors-sdk";

export async function sendGmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ ok: true } | { ok: false; status?: number; body?: string }> {
  const { to, subject, html, from = "me" } = params;

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${subject}`,
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

  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "google-mail",
    `/gmail/v1/users/${from}/messages/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encoded }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, status: response.status, body };
  }

  return { ok: true };
}
