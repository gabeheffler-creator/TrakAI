import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, coachesTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/auth/coach/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.username, username));
    if (!coach || !coach.passwordHash) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const valid = await bcrypt.compare(password, coach.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    req.session.coachId = coach.id;
    delete req.session.clientId;
    res.json({ ok: true, role: "coach", id: coach.id, name: coach.name });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/client/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.username, username));
    if (!client || !client.passwordHash) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const valid = await bcrypt.compare(password, client.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    if (client.status === "inactive") {
      res.status(403).json({ error: "This account has been deactivated by your coach" });
      return;
    }
    req.session.clientId = client.id;
    delete req.session.coachId;
    res.json({ ok: true, role: "client", id: client.id, name: client.name });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error(err);
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("trak_session");
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res) => {
  try {
    if (req.session.coachId) {
      const [coach] = await db.select().from(coachesTable).where(eq(coachesTable.id, req.session.coachId));
      if (coach) {
        res.json({ role: "coach", id: coach.id, name: coach.name });
        return;
      }
    }
    if (req.session.clientId) {
      const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.session.clientId));
      if (client) {
        res.json({ role: "client", id: client.id, name: client.name });
        return;
      }
    }
    res.status(401).json({ error: "Not logged in" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get session" });
  }
});

export default router;
