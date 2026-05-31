import express from "express";
import cors from "cors";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { isGeminiConfigured } from "./services/gemini";
import { defineRouter } from "./routes/define";
import { sessionsRouter } from "./routes/sessions";
import { wordsRouter, themesRouter } from "./routes/words";
import { quizRouter } from "./routes/quiz";
import { essayRouter } from "./routes/essay";
import { sentencesRouter } from "./routes/sentences";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", geminiConfigured: isGeminiConfigured() });
});

app.use("/api", defineRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/words", wordsRouter);
app.use("/api/themes", themesRouter);
app.use("/api/quiz", quizRouter);
app.use("/api/essay", essayRouter);
app.use("/api/sentences", sentencesRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!isGeminiConfigured()) console.warn("Warning: GEMINI_API_KEY not set");
});
