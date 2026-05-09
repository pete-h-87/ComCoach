import express from "express";
import cors from "cors";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { pool } from "./db";

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";

app.use(cors());
app.use(express.json());

// Calls Gemini with retry + model fallback when the primary model is overloaded.
// Retries on 429/503 with exponential backoff, then falls back to a lighter model.
async function callGeminiWithRetry(
  body: unknown,
  maxAttempts = 3
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const models = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (r.ok) {
          const data: any = await r.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text !== "string") {
            return { ok: false, status: 502, error: "unexpected gemini response" };
          }
          if (model !== GEMINI_MODEL) {
            console.log(`[gemini] succeeded via fallback model "${model}"`);
          }
          return { ok: true, text };
        }

        // Retry only on rate-limit / overload codes; otherwise bail out.
        const transient = r.status === 429 || r.status === 503;
        const errText = await r.text();
        console.error(`Gemini error (${model}, attempt ${attempt}):`, r.status, errText);

        if (!transient) {
          return { ok: false, status: 502, error: "gemini request failed" };
        }

        if (attempt < maxAttempts) {
          const backoffMs = 400 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      } catch (e) {
        console.error(`Gemini fetch threw (${model}, attempt ${attempt}):`, e);
        if (attempt < maxAttempts) {
          const backoffMs = 400 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }
    console.warn(`[gemini] model "${model}" exhausted retries; trying next model`);
  }
  return { ok: false, status: 503, error: "gemini unavailable" };
}

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
    const definitionEn = String(parsed.definitionEn ?? "").trim().split(/\s+/)[0] ?? "";

    return res.json({ definitionNo, definitionEn });
  } catch (e) {
    console.error("Define route error:", e);
    return res.status(500).json({ error: "lookup failed" });
  }
});

// Generates a very short topic descriptor for a chunk of text using Gemini.
// Body: { text: string }
// Returns: { theme: string }
app.post("/api/theme", async (req, res) => {
  const { text } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text required" });
  }
  if (!GEMINI_API_KEY) {
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

// Saves a learning session (text + theme + double-clicked words with their definitions).
// Body: { text: string, sessionTheme: string, words: Array<{ word, definitionNo, definitionEn }> }
app.post("/api/sessions", async (req, res) => {
  const { text, sessionTheme, words } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text required" });
  }
  if (!Array.isArray(words)) {
    return res.status(400).json({ error: "words must be an array" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sessionResult = await client.query<{ id: number }>(
      `INSERT INTO sessions (session_theme, text) VALUES ($1, $2) RETURNING id`,
      [sessionTheme || null, text]
    );
    const sessionId = sessionResult.rows[0].id;

    if (words.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      words.forEach((w: any, i: number) => {
        const base = i * 4;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        values.push(sessionId, w.word, w.definitionNo, w.definitionEn);
      });
      await client.query(
        `INSERT INTO session_words (session_id, word, definition_no, definition_en)
         VALUES ${placeholders.join(", ")}`,
        values
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true, sessionId });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Save session error:", e);
    return res.status(500).json({ error: "save failed" });
  } finally {
    client.release();
  }
});

// Grades a quiz answer with Gemini.
// Body: { word, expectedAnswer, userAnswer, language: "en" | "no" }
// Returns: { correct: boolean, feedback: string }
app.post("/api/quiz/check", async (req, res) => {
  const { word, expectedAnswer, userAnswer, language } = req.body ?? {};

  if (typeof word !== "string" || !word.trim()) {
    return res.status(400).json({ error: "word required" });
  }
  if (typeof expectedAnswer !== "string") {
    return res.status(400).json({ error: "expectedAnswer required" });
  }
  if (typeof userAnswer !== "string") {
    return res.status(400).json({ error: "userAnswer required" });
  }
  if (language !== "en" && language !== "no") {
    return res.status(400).json({ error: "language must be 'en' or 'no'" });
  }
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  // Quick reject for empty answers — saves a Gemini call.
  if (!userAnswer.trim()) {
    return res.json({ correct: false, feedback: "No answer provided." });
  }

  const langLabel = language === "en" ? "English" : "Norwegian";
  const prompt = [
    `You are grading one vocabulary quiz answer.`,
    `Norwegian word: "${word}"`,
    `Expected answer (in ${langLabel}): "${expectedAnswer}"`,
    `User's answer: "${userAnswer}"`,
    ``,
    `Decide if the user's answer is essentially correct. Be lenient with:`,
    `- minor spelling errors or accents`,
    `- synonyms, paraphrases, or different valid translations`,
    `- equivalent ways of expressing the same meaning`,
    ``,
    `Be strict with:`,
    `- factually wrong meanings`,
    `- empty, off-topic, or gibberish answers`,
    ``,
    `Return JSON:`,
    `- "correct": boolean`,
    `- "feedback": one short sentence (max 15 words) explaining the verdict`,
  ].join("\n");

  try {
    const result = await callGeminiWithRetry({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            correct: { type: "BOOLEAN" },
            feedback: { type: "STRING" },
          },
          required: ["correct", "feedback"],
        },
        temperature: 0.1,
      },
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const parsed = JSON.parse(result.text);
    return res.json({
      correct: !!parsed.correct,
      feedback: String(parsed.feedback ?? "").trim(),
    });
  } catch (e) {
    console.error("Quiz check error:", e);
    return res.status(500).json({ error: "check failed" });
  }
});

// Lists distinct session themes (for the quiz subject picker).
app.get("/api/themes", async (_req, res) => {
  try {
    const result = await pool.query<{ session_theme: string }>(
      `SELECT DISTINCT session_theme
       FROM sessions
       WHERE session_theme IS NOT NULL AND session_theme <> ''
       ORDER BY session_theme ASC`
    );
    return res.json({ themes: result.rows.map((r) => r.session_theme) });
  } catch (e) {
    console.error("List themes error:", e);
    return res.status(500).json({ error: "list failed" });
  }
});

// Returns a quiz word set.
// Query: type=recent|random|theme, theme=<string> (when type=theme), limit=<n> (default 10)
app.get("/api/quiz", async (req, res) => {
  const type = String(req.query.type ?? "");
  const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 10) || 10));
  const theme = typeof req.query.theme === "string" ? req.query.theme : "";

  if (!["recent", "random", "theme"].includes(type)) {
    return res.status(400).json({ error: "invalid type" });
  }
  if (type === "theme" && !theme.trim()) {
    return res.status(400).json({ error: "theme required" });
  }

  try {
    let query: string;
    let params: unknown[];

    if (type === "recent") {
      query = `
        SELECT * FROM (
          SELECT DISTINCT ON (LOWER(sw.word))
            sw.id, sw.word, sw.definition_no, sw.definition_en,
            s.session_theme, s.created_at
          FROM session_words sw
          JOIN sessions s ON s.id = sw.session_id
          ORDER BY LOWER(sw.word), sw.id DESC
        ) t
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $1`;
      params = [limit];
    } else if (type === "random") {
      query = `
        SELECT * FROM (
          SELECT DISTINCT ON (LOWER(sw.word))
            sw.id, sw.word, sw.definition_no, sw.definition_en,
            s.session_theme, s.created_at
          FROM session_words sw
          JOIN sessions s ON s.id = sw.session_id
          ORDER BY LOWER(sw.word), sw.id DESC
        ) t
        ORDER BY RANDOM()
        LIMIT $1`;
      params = [limit];
    } else {
      query = `
        SELECT * FROM (
          SELECT DISTINCT ON (LOWER(sw.word))
            sw.id, sw.word, sw.definition_no, sw.definition_en,
            s.session_theme, s.created_at
          FROM session_words sw
          JOIN sessions s ON s.id = sw.session_id
          WHERE s.session_theme = $1
          ORDER BY LOWER(sw.word), sw.id DESC
        ) t
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $2`;
      params = [theme, limit];
    }

    const result = await pool.query<{
      id: number;
      word: string;
      definition_no: string;
      definition_en: string;
      session_theme: string | null;
      created_at: string;
    }>(query, params);

    return res.json({
      words: result.rows.map((r) => ({
        id: r.id,
        word: r.word,
        definitionNo: r.definition_no,
        definitionEn: r.definition_en,
        sessionTheme: r.session_theme,
      })),
    });
  } catch (e) {
    console.error("Quiz fetch error:", e);
    return res.status(500).json({ error: "fetch failed" });
  }
});

// Lists all unique words ever saved, newest first.
// Dedupes by lowercase word; keeps the most recent definition.
app.get("/api/words", async (_req, res) => {
  try {
    const result = await pool.query<{
      id: number;
      word: string;
      definition_no: string;
      definition_en: string;
      session_id: number;
      session_theme: string | null;
      created_at: string;
    }>(
      `SELECT * FROM (
         SELECT DISTINCT ON (LOWER(sw.word))
           sw.id,
           sw.word,
           sw.definition_no,
           sw.definition_en,
           sw.session_id,
           s.session_theme,
           s.created_at
         FROM session_words sw
         JOIN sessions s ON s.id = sw.session_id
         ORDER BY LOWER(sw.word), sw.id DESC
       ) t
       ORDER BY t.created_at DESC, t.id DESC`
    );
    return res.json({
      words: result.rows.map((r) => ({
        id: r.id,
        word: r.word,
        definitionNo: r.definition_no,
        definitionEn: r.definition_en,
        sessionId: r.session_id,
        sessionTheme: r.session_theme,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error("List words error:", e);
    return res.status(500).json({ error: "list failed" });
  }
});

// Lists all saved sessions, newest first.
app.get("/api/sessions", async (_req, res) => {
  try {
    const result = await pool.query<{
      id: number;
      session_theme: string | null;
      text: string;
      created_at: string;
    }>(
      `SELECT id, session_theme, text, created_at
       FROM sessions
       ORDER BY created_at DESC`
    );
    return res.json({
      sessions: result.rows.map((r) => ({
        id: r.id,
        sessionTheme: r.session_theme,
        text: r.text,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error("List sessions error:", e);
    return res.status(500).json({ error: "list failed" });
  }
});

// Fetches one session including its highlighted words.
app.get("/api/sessions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });

  try {
    const session = await pool.query(
      `SELECT id, session_theme, text, created_at FROM sessions WHERE id = $1`,
      [id]
    );
    if (session.rowCount === 0) return res.status(404).json({ error: "not found" });

    const words = await pool.query(
      `SELECT id, word, definition_no, definition_en
       FROM session_words
       WHERE session_id = $1
       ORDER BY id ASC`,
      [id]
    );

    const s = session.rows[0];
    return res.json({
      id: s.id,
      sessionTheme: s.session_theme,
      text: s.text,
      createdAt: s.created_at,
      words: words.rows.map((w) => ({
        id: w.id,
        word: w.word,
        definitionNo: w.definition_no,
        definitionEn: w.definition_en,
      })),
    });
  } catch (e) {
    console.error("Get session error:", e);
    return res.status(500).json({ error: "fetch failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) console.warn("Warning: GEMINI_API_KEY not set");
});
