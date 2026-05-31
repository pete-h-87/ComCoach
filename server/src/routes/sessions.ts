import { Router } from "express";
import { pool } from "../db";

export const sessionsRouter = Router();

// Saves a learning session (text + theme + double-clicked words with their definitions).
// Body: { text: string, sessionTheme: string, words: Array<{ word, definitionNo, definitionEn }> }
sessionsRouter.post("/", async (req, res) => {
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

// Lists all saved sessions, newest first.
sessionsRouter.get("/", async (_req, res) => {
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
sessionsRouter.get("/:id", async (req, res) => {
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
