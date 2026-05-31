import { Router } from "express";
import { pool } from "../db";

export const wordsRouter = Router();
export const themesRouter = Router();

// Lists all unique words ever saved, newest first.
// Dedupes by lowercase word; keeps the most recent definition.
wordsRouter.get("/", async (_req, res) => {
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

// Lists distinct session themes (for the quiz subject picker).
themesRouter.get("/", async (_req, res) => {
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
