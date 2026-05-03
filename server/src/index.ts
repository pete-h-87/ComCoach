import express from "express";
import cors from "cors";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", geminiConfigured: !!GEMINI_API_KEY });
});

// Defines a Norwegian word in context using Gemini.
// Body: { word: string, context: string }
// Returns: { definitionNo: string, definitionEn: string }
app.post("/api/define", async (req, res) => {
  const { word, context } = req.body ?? {};
  if (typeof word !== "string" || !word.trim()) {
    return res.status(400).json({ error: "word required" });
  }
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const prompt = [
    `Norwegian word: "${word}"`,
    context ? `Sentence/paragraph it appears in: "${context}"` : `(no context provided)`,
    ``,
    `Return JSON with two fields:`,
    `- "definitionNo": a concise Norwegian definition of the word as used in this context. Max 10 words. No example sentence. No filler.`,
    `- "definitionEn": the single best one-word English translation. One word only.`,
  ].join("\n");

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Gemini error:", r.status, errText);
      return res.status(502).json({ error: "gemini request failed" });
    }

    const data: any = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      return res.status(502).json({ error: "unexpected gemini response" });
    }

    const parsed = JSON.parse(text);
    const definitionNo = String(parsed.definitionNo ?? "").trim();
    const definitionEn = String(parsed.definitionEn ?? "").trim().split(/\s+/)[0] ?? "";

    return res.json({ definitionNo, definitionEn });
  } catch (e) {
    console.error("Define route error:", e);
    return res.status(500).json({ error: "lookup failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) console.warn("Warning: GEMINI_API_KEY not set");
});
