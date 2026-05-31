import { Router } from "express";
import { callGeminiWithRetry, isGeminiConfigured } from "../services/gemini";

export const defineRouter = Router();

// Defines a Norwegian word in context using Gemini.
// Body: { word: string, context: string }
// Returns: { definitionNo: string, definitionEn: string }
defineRouter.post("/define", async (req, res) => {
  const { word, context } = req.body ?? {};
  if (typeof word !== "string" || !word.trim()) {
    return res.status(400).json({ error: "word required" });
  }
  if (!isGeminiConfigured()) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const isPhrase = /\s/.test(word.trim());
  const prompt = [
    isPhrase ? `Norwegian phrase: "${word}"` : `Norwegian word: "${word}"`,
    context ? `Sentence/paragraph it appears in: "${context}"` : `(no context provided)`,
    ``,
    `Return JSON with two fields:`,
    isPhrase
      ? `- "definitionNo": a concise Norwegian paraphrase or explanation of this phrase as used in this context. Max 12 words. No example sentence.`
      : `- "definitionNo": a concise Norwegian definition of the word as used in this context. Max 10 words. No example sentence. No filler.`,
    isPhrase
      ? `- "definitionEn": the natural English translation of the phrase. As short and idiomatic as possible. Multi-word is fine.`
      : `- "definitionEn": the single best one-word English translation. One word only.`,
  ].join("\n");

  try {
    const result = await callGeminiWithRetry({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            definitionNo: { type: "STRING" },
            definitionEn: { type: "STRING" },
          },
          required: ["definitionNo", "definitionEn"],
        },
        temperature: 0.2,
      },
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const parsed = JSON.parse(result.text);
    const definitionNo = String(parsed.definitionNo ?? "").trim();
    const rawEn = String(parsed.definitionEn ?? "").trim();
    const definitionEn = isPhrase ? rawEn : (rawEn.split(/\s+/)[0] ?? "");

    return res.json({ definitionNo, definitionEn });
  } catch (e) {
    console.error("Define route error:", e);
    return res.status(500).json({ error: "lookup failed" });
  }
});

// Generates a very short topic descriptor for a chunk of text using Gemini.
// Body: { text: string }
// Returns: { theme: string }
defineRouter.post("/theme", async (req, res) => {
  const { text } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text required" });
  }
  if (!isGeminiConfigured()) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const prompt = [
    `Read the following text and produce a very short topic descriptor (2-5 words) summarizing what it is about.`,
    `The theme MUST be written in Norwegian (Bokmål), regardless of the language of the source text.`,
    `Return JSON with one field "theme". No punctuation at the end. Title Case.`,
    ``,
    `Text:`,
    `"""`,
    text,
    `"""`,
  ].join("\n");

  try {
    const result = await callGeminiWithRetry({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { theme: { type: "STRING" } },
          required: ["theme"],
        },
        temperature: 0.3,
      },
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const parsed = JSON.parse(result.text);
    const theme = String(parsed.theme ?? "").trim();
    return res.json({ theme });
  } catch (e) {
    console.error("Theme route error:", e);
    return res.status(500).json({ error: "theme lookup failed" });
  }
});
