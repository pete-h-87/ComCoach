import { useEffect, useState } from "react";
import "./Quiz.css";

type QuizType = "recent" | "random" | "theme";
type Difficulty = "beginner" | "expert";
type Phase = "picker" | "loading" | "active" | "done" | "error";

interface QuizWord {
  id: number;
  word: string;
  definitionNo: string;
  definitionEn: string;
  sessionTheme: string | null;
}

interface GradedWord extends QuizWord {
  correct: boolean;
  userAnswer: string;
  feedback: string;
}

const QUIZ_TYPE_LABELS: Record<QuizType, { title: string; desc: string }> = {
  recent: { title: "Recent Words", desc: "10 words from your latest sessions" },
  random: { title: "Random Words", desc: "10 words from anywhere in your list" },
  theme: { title: "By Subject", desc: "10 words from a session theme" },
};

const DIFFICULTY_LABELS: Record<Difficulty, { title: string; desc: string }> = {
  beginner: { title: "Beginner", desc: "Define in English" },
  expert: { title: "Expert", desc: "Define in Norwegian" },
};

export default function Quiz() {
  const [phase, setPhase] = useState<Phase>("picker");
  const [type, setType] = useState<QuizType>("recent");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [themes, setThemes] = useState<string[]>([]);
  const [theme, setTheme] = useState("");
  const [words, setWords] = useState<QuizWord[]>([]);
  const [index, setIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [graded, setGraded] = useState<GradedWord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/themes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        setThemes(data.themes ?? []);
        if (data.themes?.length) setTheme((prev) => prev || data.themes[0]);
      })
      .catch(() => {
        // Non-fatal — themes just won't be available
      });
  }, []);

  const startQuiz = async () => {
    setPhase("loading");
    setError("");
    const params = new URLSearchParams({ type, limit: "10" });
    if (type === "theme") params.set("theme", theme);

    try {
      const res = await fetch(`/api/quiz?${params.toString()}`);
      if (!res.ok) {
        setError("Failed to load quiz.");
        setPhase("error");
        return;
      }
      const data = await res.json();
      const fetched: QuizWord[] = data.words ?? [];
      if (fetched.length === 0) {
        setError("No words available for this quiz. Save a session first.");
        setPhase("error");
        return;
      }
      setWords(fetched);
      setIndex(0);
      setUserAnswer("");
      setResult(null);
      setGraded([]);
      setPhase("active");
    } catch {
      setError("Network error.");
      setPhase("error");
    }
  };

  const submitAnswer = async () => {
    const current = words[index];
    if (!current || checking) return;
    const expected =
      difficulty === "beginner" ? current.definitionEn : current.definitionNo;
    setChecking(true);
    try {
      const res = await fetch("/api/quiz/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: current.word,
          expectedAnswer: expected,
          userAnswer,
          language: difficulty === "beginner" ? "en" : "no",
        }),
      });
      if (!res.ok) {
        setResult({ correct: false, feedback: "Grading unavailable — counted as missed." });
      } else {
        const data = await res.json();
        setResult({ correct: !!data.correct, feedback: String(data.feedback ?? "") });
      }
    } catch {
      setResult({ correct: false, feedback: "Network error — counted as missed." });
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    if (!result) return;
    const current = words[index];
    setGraded((prev) => [
      ...prev,
      { ...current, correct: result.correct, userAnswer, feedback: result.feedback },
    ]);
    if (index + 1 >= words.length) {
      setPhase("done");
    } else {
      setIndex((i) => i + 1);
      setUserAnswer("");
      setResult(null);
    }
  };

  const resetToPicker = () => {
    setPhase("picker");
    setUserAnswer("");
    setResult(null);
    setGraded([]);
    setIndex(0);
    setWords([]);
  };

  const retrySame = () => {
    setIndex(0);
    setUserAnswer("");
    setResult(null);
    setGraded([]);
    setPhase("active");
  };

  // ---------- Picker ----------
  if (phase === "picker") {
    const themeDisabled = type === "theme" && themes.length === 0;
    return (
      <div className="quiz-page">
        <h2 className="quiz-title">Quiz</h2>
        <div className="quiz-picker">
          <div>
            <p className="quiz-section-label">Quiz Type</p>
            <div className="quiz-options">
              {(Object.keys(QUIZ_TYPE_LABELS) as QuizType[]).map((t) => (
                <button
                  key={t}
                  className={`quiz-option ${type === t ? "quiz-option--selected" : ""}`}
                  onClick={() => setType(t)}
                >
                  <span>{QUIZ_TYPE_LABELS[t].title}</span>
                  <span className="quiz-option-desc">{QUIZ_TYPE_LABELS[t].desc}</span>
                </button>
              ))}
            </div>
          </div>

          {type === "theme" && (
            <div>
              <p className="quiz-section-label">Subject</p>
              {themes.length === 0 ? (
                <p className="quiz-error">
                  No saved sessions with themes yet. Save a session first.
                </p>
              ) : (
                <select
                  className="quiz-theme-select"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  {themes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <p className="quiz-section-label">Difficulty</p>
            <div className="quiz-options quiz-options-2">
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  className={`quiz-option ${difficulty === d ? "quiz-option--selected" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  <span>{DIFFICULTY_LABELS[d].title}</span>
                  <span className="quiz-option-desc">{DIFFICULTY_LABELS[d].desc}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="quiz-start"
            onClick={startQuiz}
            disabled={themeDisabled}
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  // ---------- Loading / Error ----------
  if (phase === "loading") {
    return (
      <div className="quiz-page">
        <h2 className="quiz-title">Quiz</h2>
        <p className="quiz-loading">Loading…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="quiz-page">
        <h2 className="quiz-title">Quiz</h2>
        <p className="quiz-error">{error}</p>
        <button className="quiz-start" onClick={resetToPicker}>Back</button>
      </div>
    );
  }

  // ---------- Active ----------
  if (phase === "active") {
    const current = words[index];
    const score = graded.filter((g) => g.correct).length;
    const expectedAnswer =
      difficulty === "beginner" ? current.definitionEn : current.definitionNo;
    const promptLabel =
      difficulty === "beginner" ? "Define in English" : "Define in Norwegian";

    return (
      <div className="quiz-page">
        <h2 className="quiz-title">Quiz</h2>
        <div className="quiz-active">
          <div className="quiz-progress">
            <span>Question {index + 1} of {words.length}</span>
            <span className="quiz-progress-score">{score} correct</span>
          </div>

          <div className="quiz-card">
            <span className="quiz-prompt-label">{promptLabel}</span>
            <div className="quiz-word">{current.word}</div>

            <input
              className="quiz-input"
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !result && !checking) submitAnswer();
                if (e.key === "Enter" && result) next();
              }}
              placeholder="Type your answer…"
              disabled={!!result || checking}
              autoFocus
            />

            {result && (
              <div
                className={`quiz-verdict ${
                  result.correct ? "quiz-verdict--correct" : "quiz-verdict--missed"
                }`}
              >
                <div className="quiz-verdict-mark">
                  {result.correct ? "✓ Correct" : "✗ Missed"}
                </div>
                {result.feedback && <div className="quiz-verdict-feedback">{result.feedback}</div>}
                <div className="quiz-verdict-expected">
                  <span className="quiz-verdict-expected-label">Expected:</span>{" "}
                  {expectedAnswer || "(no answer recorded)"}
                </div>
              </div>
            )}

            <div className="quiz-actions">
              {!result ? (
                <button
                  className="quiz-button quiz-button-reveal"
                  onClick={submitAnswer}
                  disabled={checking || !userAnswer.trim()}
                >
                  {checking ? "Checking…" : "Submit"}
                </button>
              ) : (
                <button
                  className="quiz-button quiz-button-reveal"
                  onClick={next}
                >
                  {index + 1 >= words.length ? "Finish" : "Next"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Done ----------
  const correctCount = graded.filter((g) => g.correct).length;
  return (
    <div className="quiz-page">
      <h2 className="quiz-title">Quiz Complete</h2>
      <div className="quiz-done">
        <div className="quiz-score">
          {correctCount}
          <span className="quiz-score-fraction">/{graded.length}</span>
        </div>

        <div className="quiz-summary">
          {graded.map((g, i) => {
            const expected = difficulty === "beginner" ? g.definitionEn : g.definitionNo;
            return (
              <div key={`${g.id}-${i}`} className="quiz-summary-row">
                <span
                  className={`quiz-summary-mark ${
                    g.correct ? "quiz-summary-mark--correct" : "quiz-summary-mark--missed"
                  }`}
                >
                  {g.correct ? "✓" : "✗"}
                </span>
                <span className="quiz-summary-word">{g.word}</span>
                <span className="quiz-summary-answer">
                  {!g.correct && g.userAnswer && (
                    <span className="quiz-summary-yours">"{g.userAnswer}" → </span>
                  )}
                  {expected}
                </span>
              </div>
            );
          })}
        </div>

        <div className="quiz-done-actions">
          <button className="quiz-start" onClick={retrySame}>Try Again</button>
          <button className="quiz-start" onClick={resetToPicker}>New Quiz</button>
        </div>
      </div>
    </div>
  );
}
