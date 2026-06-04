import { Router } from "express";
import { GetUploadUrlBody } from "@workspace/api-zod";

const router = Router();

router.post("/upload-url", async (req, res) => {
  try {
    const body = GetUploadUrlBody.parse(req.body);
    const key = `uploads/${Date.now()}-${body.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const publicUrl = `https://storage.example.com/${key}`;
    res.json({ uploadUrl: publicUrl, publicUrl });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to get upload URL" });
  }
});

export default router;
