import { Router } from "express";
import { pool } from "../db";
import { callGeminiWithRetry, isGeminiConfigured } from "../services/gemini";

export const quizRouter = Router();

// Returns a quiz word set.
// Query: type=recent|random|theme, theme=<string> (when type=theme), limit=<n> (default 10)
quizRouter.get("/", async (req, res) => {
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

// Grades a quiz answer with Gemini.
// Body: { word, expectedAnswer, userAnswer, language: "en" | "no" }
// Returns: { correct: boolean, feedback: string }
quizRouter.post("/check", async (req, res) => {
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
  if (!isGeminiConfigured()) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

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

// Save a quiz attempt record.
quizRouter.post("/attempts", async (req, res) => {
  const { quizType, difficulty, theme, total, correct } = req.body ?? {};
  if (!["recent", "random", "theme"].includes(String(quizType))) {
    return res.status(400).json({ error: "invalid quizType" });
  }
  if (!["beginner", "expert"].includes(String(difficulty))) {
    return res.status(400).json({ error: "invalid difficulty" });
  }
  if (!Number.isInteger(total) || !Number.isInteger(correct) || total < 0 || correct < 0 || correct > total) {
    return res.status(400).json({ error: "invalid total/correct" });
  }

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO quiz_attempts (quiz_type, difficulty, theme, total, correct)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [quizType, difficulty, theme || null, total, correct]
    );
    return res.json({ ok: true, id: result.rows[0].id });
  } catch (e) {
    console.error("Save quiz attempt error:", e);
    return res.status(500).json({ error: "save failed" });
  }
});

// List quiz attempts.
quizRouter.get("/attempts", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, quiz_type, difficulty, theme, total, correct, created_at
       FROM quiz_attempts
       ORDER BY created_at DESC, id DESC
       LIMIT 100`
    );
    return res.json({
      attempts: result.rows.map((r: any) => ({
        id: r.id,
        quizType: r.quiz_type,
        difficulty: r.difficulty,
        theme: r.theme,
        total: r.total,
        correct: r.correct,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error("List quiz attempts error:", e);
    return res.status(500).json({ error: "list failed" });
  }
});
