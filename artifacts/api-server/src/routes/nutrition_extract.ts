import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
const router = Router();

router.post("/nutrition/extract", async (req, res) => {
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

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 512,
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
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    let parsed: { calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; sodium?: number | null } = {};
    try {
      // Strip markdown code fences if model wrapped output in them
      const clean = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      req.log.warn({ raw }, "Failed to parse AI nutrition response as JSON");
    }

    res.json({
      calories: parsed.calories ?? null,
      protein: parsed.protein ?? null,
      carbs: parsed.carbs ?? null,
      fat: parsed.fat ?? null,
      sodium: parsed.sodium ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to extract nutrition data" });
  }
});

export default router;
