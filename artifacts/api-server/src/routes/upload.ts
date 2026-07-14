import { Router } from "express";
import { GetUploadUrlBody } from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const objectStorage = new ObjectStorageService();

router.post("/upload-url", async (req, res) => {
  try {
    GetUploadUrlBody.parse(req.body);
    const uploadUrl = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
    res.json({ uploadUrl, objectPath, publicUrl: `/api/storage${objectPath}` });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to get upload URL" });
  }
});

export default router;
