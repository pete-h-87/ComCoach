import { Router } from "express";
import { pool } from "../db";
import { callGeminiWithRetry, isGeminiConfigured } from "../services/gemini";

export const essayRouter = Router();

// Generates a Norwegian writing prompt for a short essay, calibrated to a learner level.
// Body: { level?: "A1" | "A2" | "B1" | "B2", theme?: string }
// Returns: { prompt: string, promptEn: string }
essayRouter.post("/prompt", async (req, res) => {
  const level = String(req.body?.level ?? "B1");
  const theme = typeof req.body?.theme === "string" ? req.body.theme.trim() : "";
  if (!["A1", "A2", "B1", "B2"].includes(level)) {
    return res.status(400).json({ error: "invalid level" });
  }
  if (!isGeminiConfigured()) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const promptText = [
    `Generate a short writing prompt for a Norwegian (Bokmål) language learner at CEFR level ${level}.`,
    `The prompt should ask the learner to write one paragraph (about 5-8 sentences) on a concrete, everyday topic.`,
    theme
      ? `The prompt MUST be related to this subject the learner has been studying: "${theme}". Frame the question or scenario around that subject.`
      : `The prompt should resemble the kind of writing tasks asked on the official Norwegian language exams (Norskprøven / Bergenstesten) at CEFR level ${level}. Typical task types: describing personal experiences, daily routines, work or studies, society and culture, opinions on familiar issues, comparing two things, and — for B1/B2 — argumentative or analytical writing on social topics (e.g. environment, technology, work-life balance, integration, education, urban vs. rural life). Vary the topic type each time.`,
    ``,
    `Return JSON:`,
    `- "prompt": the writing prompt itself, in Norwegian (Bokmål). One or two sentences. End with a period or question mark.`,
    `- "promptEn": the same prompt translated to English.`,
  ].join("\n");

  try {
    const result = await callGeminiWithRetry({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            prompt: { type: "STRING" },
            promptEn: { type: "STRING" },
          },
          required: ["prompt", "promptEn"],
        },
        temperature: 0.9,
      },
    });

    if (!result.ok) return res.status(result.status).json({ error: result.error });

    const parsed = JSON.parse(result.text);
    return res.json({
      prompt: String(parsed.prompt ?? "").trim(),
      promptEn: String(parsed.promptEn ?? "").trim(),
    });
  } catch (e) {
    console.error("Essay prompt error:", e);
    return res.status(500).json({ error: "prompt failed" });
  }
});

// Grades a Norwegian short essay with Gemini.
// Body: { topic: string, essay: string }
// Returns: { level, feedback, correctedText, nextLevelText, notes: [{ issue, suggestion }] }
essayRouter.post("/grade", async (req, res) => {
  const { topic, essay } = req.body ?? {};
  if (typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "topic required" });
  }
  if (typeof essay !== "string" || !essay.trim()) {
    return res.status(400).json({ error: "essay required" });
  }
  if (!isGeminiConfigured()) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const promptText = [
    `You are a Norwegian (Bokmål) language teacher grading a short essay by a learner.`,
    ``,
    `Topic given to the student:`,
    `"""`,
    topic,
    `"""`,
    ``,
    `Student's essay:`,
    `"""`,
    essay,
    `"""`,
    ``,
    `Return JSON with these fields:`,
    `- "level": one of "A1", "A2", "B1", "B2" reflecting the CEFR level demonstrated. Judge based on vocabulary range, sentence complexity, grammatical accuracy, and how on-topic the response is. Be honest.`,
    `- "feedback": 1-2 sentences of overall feedback in English. Plain, direct.`,
    `- "correctedText": the essay rewritten in correct Norwegian (Bokmål). Preserve the student's meaning and voice; fix grammar, spelling, word choice, and unnatural phrasing. Do not expand the content.`,
    `- "nextLevelText": IF the achieved level is A1, A2, or B1, rewrite the SAME essay at the next CEFR level up (A1→A2, A2→B1, B1→B2). Use richer vocabulary, more varied sentence structure, and more idiomatic Norwegian appropriate for that higher level — but keep the original meaning and overall length. IF the achieved level is already B2, return an empty string "".`,
    `- "notes": an array of 2-5 short objects, each describing one specific issue. Each object has:`,
    `    - "issue": a short phrase (in English) naming the error type or pattern (e.g. "verb conjugation", "word order", "missing article").`,
    `    - "suggestion": a one-sentence tip in English on how to fix it, with the corrected Norwegian form quoted if helpful.`,
  ].join("\n");

  try {
    const result = await callGeminiWithRetry({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            level: { type: "STRING" },
            feedback: { type: "STRING" },
            correctedText: { type: "STRING" },
            nextLevelText: { type: "STRING" },
            notes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  issue: { type: "STRING" },
                  suggestion: { type: "STRING" },
                },
                required: ["issue", "suggestion"],
              },
            },
          },
          required: ["level", "feedback", "correctedText", "nextLevelText", "notes"],
        },
        temperature: 0.2,
      },
    });

    if (!result.ok) return res.status(result.status).json({ error: result.error });

    const parsed = JSON.parse(result.text);
    const levelOut = ["A1", "A2", "B1", "B2"].includes(parsed.level) ? parsed.level : "A2";
    const nextLevelText =
      levelOut === "B2" ? "" : String(parsed.nextLevelText ?? "").trim();
    return res.json({
      level: levelOut,
      feedback: String(parsed.feedback ?? "").trim(),
      correctedText: String(parsed.correctedText ?? "").trim(),
      nextLevelText,
      notes: Array.isArray(parsed.notes)
        ? parsed.notes
            .filter((n: any) => n && typeof n.issue === "string" && typeof n.suggestion === "string")
            .map((n: any) => ({ issue: n.issue.trim(), suggestion: n.suggestion.trim() }))
        : [],
    });
  } catch (e) {
    console.error("Essay grade error:", e);
    return res.status(500).json({ error: "grade failed" });
  }
});

// Save an essay attempt record.
essayRouter.post("/attempts", async (req, res) => {
  const {
    targetLevel,
    achievedLevel,
    topic,
    essayText,
    correctedText,
    feedback,
    notes,
    nextLevelText,
  } = req.body ?? {};
  const validLevels = ["A1", "A2", "B1", "B2"];
  if (!validLevels.includes(String(targetLevel))) {
    return res.status(400).json({ error: "invalid targetLevel" });
  }
  if (!validLevels.includes(String(achievedLevel))) {
    return res.status(400).json({ error: "invalid achievedLevel" });
  }
  if (typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "topic required" });
  }
  if (typeof essayText !== "string" || !essayText.trim()) {
    return res.status(400).json({ error: "essayText required" });
  }
  if (typeof correctedText !== "string") {
    return res.status(400).json({ error: "correctedText required" });
  }

  const cleanNotes = Array.isArray(notes)
    ? notes
        .filter(
          (n: any) =>
            n &&
            typeof n.issue === "string" &&
            typeof n.suggestion === "string"
        )
        .map((n: any) => ({
          issue: n.issue.trim(),
          suggestion: n.suggestion.trim(),
        }))
    : [];

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO essay_attempts
         (target_level, achieved_level, topic, essay_text, corrected_text, feedback, notes, next_level_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        targetLevel,
        achievedLevel,
        topic,
        essayText,
        correctedText,
        feedback || null,
        JSON.stringify(cleanNotes),
        typeof nextLevelText === "string" && nextLevelText.trim() ? nextLevelText.trim() : null,
      ]
    );
    return res.json({ ok: true, id: result.rows[0].id });
  } catch (e) {
    console.error("Save essay attempt error:", e);
    return res.status(500).json({ error: "save failed" });
  }
});

// List essay attempts.
essayRouter.get("/attempts", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, target_level, achieved_level, topic, feedback, created_at
       FROM essay_attempts
       ORDER BY created_at DESC, id DESC
       LIMIT 100`
    );
    return res.json({
      attempts: result.rows.map((r: any) => ({
        id: r.id,
        targetLevel: r.target_level,
        achievedLevel: r.achieved_level,
        topic: r.topic,
        feedback: r.feedback,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error("List essay attempts error:", e);
    return res.status(500).json({ error: "list failed" });
  }
});

// Full essay attempt including original text + corrected text.
essayRouter.get("/attempts/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const result = await pool.query(
      `SELECT id, target_level, achieved_level, topic, essay_text,
              corrected_text, feedback, notes, next_level_text, created_at
       FROM essay_attempts
       WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "not found" });
    const r: any = result.rows[0];
    return res.json({
      id: r.id,
      targetLevel: r.target_level,
      achievedLevel: r.achieved_level,
      topic: r.topic,
      essayText: r.essay_text,
      correctedText: r.corrected_text,
      feedback: r.feedback,
      notes: Array.isArray(r.notes) ? r.notes : [],
      nextLevelText: r.next_level_text || "",
      createdAt: r.created_at,
    });
  } catch (e) {
    console.error("Get essay attempt error:", e);
    return res.status(500).json({ error: "fetch failed" });
  }
});
