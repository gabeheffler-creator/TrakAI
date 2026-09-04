import { Router } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireClientOwnership, requireCoachOnly } from "../middlewares/auth";
import { issueActionToken } from "../lib/tokens";
import { sendGmail } from "../lib/mail";
import { clientInviteUrl } from "../lib/public-auth-urls";

const router = Router();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
router.post("/clients/:clientId/invite/send-email", requireClientOwnership(), requireCoachOnly, async (req, res) => {
  const clientId = Number(req.params.clientId);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  const { token } = await issueActionToken("client", client.id, "invite_accept");
  const url = clientInviteUrl(token);
  const result = await sendGmail({ to: client.email, subject: "Your TrakAI invitation", html: `<p>Hi ${escapeHtml(client.name)},</p><p><a href="${escapeHtml(url)}">Accept your invitation</a></p>` });
  if (!result.ok) { req.log.error({ status: result.status }, "Invite delivery failed"); res.status(502).json({ error: "Failed to send invite email" }); return; }
  res.json({ ok: true });
});
export default router;