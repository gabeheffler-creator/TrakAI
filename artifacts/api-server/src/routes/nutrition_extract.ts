import { Router } from "express";
import { requireClientAuth } from "../middlewares/auth";
import { actorCaller, requestAiJson, sendAiError } from "../lib/ai-gateway";
import { aiBurstLimit } from "../lib/rate-limit";
import { z } from "zod/v4";
const router = Router();

const NutritionExtraction = z.object({
  calories: z.number().finite().nonnegative().nullable().optional(),
  protein: z.number().finite().nonnegative().nullable().optional(),
  carbs: z.number().finite().nonnegative().nullable().optional(),
  fat: z.number().finite().nonnegative().nullable().optional(),
  sodium: z.number().finite().nonnegative().nullable().optional(),
});

router.post("/nutrition/extract", requireClientAuth, aiBurstLimit, async (req, res) => {
  try {
    const imageBase64 = req.body?.imageBase64 ? String(req.body.imageBase64) : null;
    const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl) : null;
    const mimeType = String(req.body?.mimeType ?? "image/jpeg");

    if (!imageBase64 && !imageUrl) {
      res.status(400).json({ error: "imageBase64 or imageUrl is required" });
      return;
    }

    const imageContent = imageBase64
      ? `data:${mimeType};base64,${imageBase64}`
      : imageUrl!;

    const parsed = await requestAiJson<{ calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; sodium?: number | null }>({
      caller: actorCaller(req.actor),
      feature: "nutrition_extraction",
      maxCompletionTokens: 512,
      messages: [
        {
          role: "system",
          content:
            "You are a nutrition extraction assistant. The user will send a food diary screenshot (e.g. from MyFitnessPal or a meal photo). " +
            "Extract the total macros visible. Return ONLY valid JSON with keys: calories (number), protein (number, grams), carbs (number, grams), fat (number, grams), sodium (number, milligrams). " +
            "If a value is not visible or unclear, use null. Do not include any other text.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageContent },
            },
            {
              type: "text",
              text: "Extract the total macros from this food diary screenshot.",
            },
          ],
        },
      ],
      parse: (content) => NutritionExtraction.parse(
        JSON.parse(content.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "").trim()),
      ),
    });

    res.json({
      calories: parsed.calories ?? null,
      protein: parsed.protein ?? null,
      carbs: parsed.carbs ?? null,
      fat: parsed.fat ?? null,
      sodium: parsed.sodium ?? null,
    });
  } catch (err) {
    if (sendAiError(res, err)) return;
    req.log.error(err);
    res.status(500).json({ error: "Failed to extract nutrition data" });
  }
});

export default router;
