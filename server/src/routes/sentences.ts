import { Router } from "express";
import { callGeminiWithRetry, isGeminiConfigured } from "../services/gemini";

export const sentencesRouter = Router();

// Checks a learner-written Norwegian sentence that uses a target word/phrase.
// Body: { word: string, sentence: string }
// Returns: { correct: boolean, correctedSentence: string, feedback: string }
sentencesRouter.post("/check", async (req, res) => {
  const { word, sentence } = req.body ?? {};
  if (typeof word !== "string" || !word.trim()) {
    return res.status(400).json({ error: "word required" });
  }
  if (typeof sentence !== "string" || !sentence.trim()) {
    return res.status(400).json({ error: "sentence required" });
  }
  if (!isGeminiConfigured()) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const promptText = [
    `You are a Norwegian (Bokmål) language teacher.`,
    `A student was asked to write a sentence using the word/phrase: "${word}"`,
    ``,
    `Student's sentence:`,
    `"${sentence}"`,
    ``,
    `Evaluate the sentence. Return JSON:`,
    `- "correct": boolean — true if the sentence is grammatically correct and uses the word appropriately`,
    `- "correctedSentence": if there are errors, provide the corrected version in Norwegian. If already correct, return the original sentence unchanged.`,
    `- "feedback": 1-2 sentences of feedback in English. Explain what was wrong or praise what was done well. Be encouraging but honest. Max 30 words.`,
  ].join("\n");

  try {
    const result = await callGeminiWithRetry({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            correct: { type: "BOOLEAN" },
            correctedSentence: { type: "STRING" },
            feedback: { type: "STRING" },
          },
          required: ["correct", "correctedSentence", "feedback"],
        },
        temperature: 0.2,
      },
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const parsed = JSON.parse(result.text);
    return res.json({
      correct: !!parsed.correct,
      correctedSentence: String(parsed.correctedSentence ?? "").trim(),
      feedback: String(parsed.feedback ?? "").trim(),
    });
  } catch (e) {
    console.error("Sentence check error:", e);
    return res.status(500).json({ error: "check failed" });
  }
});
