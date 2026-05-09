import { useEffect, useState } from "react";
import { useLang } from "../lib/lang";
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

const TEXT = {
  en: {
    title: "Quiz",
    completeTitle: "Quiz Complete",
    quizType: "Quiz Type",
    subject: "Subject",
    difficulty: "Difficulty",
    startQuiz: "Start Quiz",
    loading: "Loading…",
    back: "Back",
    noThemes: "No saved sessions with themes yet. Save a session first.",
    typeRecentTitle: "Recent Words",
    typeRecentDesc: "10 words from your latest sessions",
    typeRandomTitle: "Random Words",
    typeRandomDesc: "10 words from anywhere in your list",
    typeThemeTitle: "By Subject",
    typeThemeDesc: "10 words from a session theme",
    diffBeginnerTitle: "Beginner",
    diffBeginnerDesc: "Define in English",
    diffExpertTitle: "Expert",
    diffExpertDesc: "Define in Norwegian",
    questionOf: (i: number, n: number) => `Question ${i} of ${n}`,
    correctCount: (n: number) => `${n} correct`,
    promptBeginner: "Define in English",
    promptExpert: "Define in Norwegian",
    typeAnswer: "Type your answer…",
    submit: "Submit",
    checking: "Checking…",
    next: "Next",
    finish: "Finish",
    correct: "✓ Correct",
    missed: "✗ Missed",
    expected: "Expected:",
    noAnswerRecorded: "(no answer recorded)",
    tryAgain: "Try Again",
    newQuiz: "New Quiz",
    failedLoad: "Failed to load quiz.",
    noWords: "No words available for this quiz. Save a session first.",
    networkError: "Network error.",
    gradingUnavailable: "Grading unavailable — counted as missed.",
    networkMissed: "Network error — counted as missed.",
  },
  no: {
    title: "Quiz",
    completeTitle: "Quiz fullført",
    quizType: "Quiz-type",
    subject: "Tema",
    difficulty: "Vanskelighetsgrad",
    startQuiz: "Start quiz",
    loading: "Laster…",
    back: "Tilbake",
    noThemes: "Ingen lagrede økter med temaer ennå. Lagre en økt først.",
    typeRecentTitle: "Siste ord",
    typeRecentDesc: "10 ord fra dine siste økter",
    typeRandomTitle: "Tilfeldige ord",
    typeRandomDesc: "10 ord fra hvor som helst i listen din",
    typeThemeTitle: "Etter tema",
    typeThemeDesc: "10 ord fra et økttema",
    diffBeginnerTitle: "Nybegynner",
    diffBeginnerDesc: "Definer på engelsk",
    diffExpertTitle: "Ekspert",
    diffExpertDesc: "Definer på norsk",
    questionOf: (i: number, n: number) => `Spørsmål ${i} av ${n}`,
    correctCount: (n: number) => `${n} riktige`,
    promptBeginner: "Definer på engelsk",
    promptExpert: "Definer på norsk",
    typeAnswer: "Skriv svaret ditt…",
    submit: "Send inn",
    checking: "Sjekker…",
    next: "Neste",
    finish: "Fullfør",
    correct: "✓ Riktig",
    missed: "✗ Bommet",
    expected: "Forventet:",
    noAnswerRecorded: "(ingen svar registrert)",
    tryAgain: "Prøv igjen",
    newQuiz: "Ny quiz",
    failedLoad: "Kunne ikke laste quiz.",
    noWords: "Ingen ord tilgjengelig for denne quizen. Lagre en økt først.",
    networkError: "Nettverksfeil.",
    gradingUnavailable: "Vurdering utilgjengelig — regnet som bommet.",
    networkMissed: "Nettverksfeil — regnet som bommet.",
  },
};

export default function Quiz() {
  const { lang } = useLang();
  const t = TEXT[lang];
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
        setError(t.failedLoad);
        setPhase("error");
        return;
      }
      const data = await res.json();
      const fetched: QuizWord[] = data.words ?? [];
      if (fetched.length === 0) {
        setError(t.noWords);
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
      setError(t.networkError);
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
        setResult({ correct: false, feedback: t.gradingUnavailable });
      } else {
        const data = await res.json();
        setResult({ correct: !!data.correct, feedback: String(data.feedback ?? "") });
      }
    } catch {
      setResult({ correct: false, feedback: t.networkMissed });
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    if (!result) return;
    const current = words[index];
    const newEntry: GradedWord = {
      ...current,
      correct: result.correct,
      userAnswer,
      feedback: result.feedback,
    };
    const finalGraded = [...graded, newEntry];
    setGraded(finalGraded);
    if (index + 1 >= words.length) {
      const correctCount = finalGraded.filter((g) => g.correct).length;
      // Fire-and-forget — don't block the UI on the score record.
      fetch("/api/quiz/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizType: type,
          difficulty,
          theme: type === "theme" ? theme : null,
          total: finalGraded.length,
          correct: correctCount,
        }),
      }).catch(() => {
        // Silent — scores not being recorded shouldn't break the flow.
      });
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

  const typeOptions: Array<{ key: QuizType; title: string; desc: string }> = [
    { key: "recent", title: t.typeRecentTitle, desc: t.typeRecentDesc },
    { key: "random", title: t.typeRandomTitle, desc: t.typeRandomDesc },
    { key: "theme", title: t.typeThemeTitle, desc: t.typeThemeDesc },
  ];
  const diffOptions: Array<{ key: Difficulty; title: string; desc: string }> = [
    { key: "beginner", title: t.diffBeginnerTitle, desc: t.diffBeginnerDesc },
    { key: "expert", title: t.diffExpertTitle, desc: t.diffExpertDesc },
  ];

  // ---------- Picker ----------
  if (phase === "picker") {
    const themeDisabled = type === "theme" && themes.length === 0;
    return (
      <div className="quiz-page">
        <h2 className="quiz-title">{t.title}</h2>
        <div className="quiz-picker">
          <div>
            <p className="quiz-section-label">{t.quizType}</p>
            <div className="quiz-options">
              {typeOptions.map((opt) => (
                <button
                  key={opt.key}
                  className={`quiz-option ${type === opt.key ? "quiz-option--selected" : ""}`}
                  onClick={() => setType(opt.key)}
                >
                  <span>{opt.title}</span>
                  <span className="quiz-option-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {type === "theme" && (
            <div>
              <p className="quiz-section-label">{t.subject}</p>
              {themes.length === 0 ? (
                <p className="quiz-error">{t.noThemes}</p>
              ) : (
                <select
                  className="quiz-theme-select"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  {themes.map((th) => (
                    <option key={th} value={th}>{th}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <p className="quiz-section-label">{t.difficulty}</p>
            <div className="quiz-options quiz-options-2">
              {diffOptions.map((opt) => (
                <button
                  key={opt.key}
                  className={`quiz-option ${difficulty === opt.key ? "quiz-option--selected" : ""}`}
                  onClick={() => setDifficulty(opt.key)}
                >
                  <span>{opt.title}</span>
                  <span className="quiz-option-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="quiz-start"
            onClick={startQuiz}
            disabled={themeDisabled}
          >
            {t.startQuiz}
          </button>
        </div>
      </div>
    );
  }

  // ---------- Loading / Error ----------
  if (phase === "loading") {
    return (
      <div className="quiz-page">
        <h2 className="quiz-title">{t.title}</h2>
        <p className="quiz-loading">{t.loading}</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="quiz-page">
        <h2 className="quiz-title">{t.title}</h2>
        <p className="quiz-error">{error}</p>
        <button className="quiz-start" onClick={resetToPicker}>{t.back}</button>
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
      difficulty === "beginner" ? t.promptBeginner : t.promptExpert;

    return (
      <div className="quiz-page">
        <h2 className="quiz-title">{t.title}</h2>
        <div className="quiz-active">
          <div className="quiz-progress">
            <span>{t.questionOf(index + 1, words.length)}</span>
            <span className="quiz-progress-score">{t.correctCount(score)}</span>
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
              placeholder={t.typeAnswer}
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
                  {result.correct ? t.correct : t.missed}
                </div>
                {result.feedback && <div className="quiz-verdict-feedback">{result.feedback}</div>}
                <div className="quiz-verdict-expected">
                  <span className="quiz-verdict-expected-label">{t.expected}</span>{" "}
                  {expectedAnswer || t.noAnswerRecorded}
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
                  {checking ? t.checking : t.submit}
                </button>
              ) : (
                <button
                  className="quiz-button quiz-button-reveal"
                  onClick={next}
                >
                  {index + 1 >= words.length ? t.finish : t.next}
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
      <h2 className="quiz-title">{t.completeTitle}</h2>
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
          <button className="quiz-start" onClick={retrySame}>{t.tryAgain}</button>
          <button className="quiz-start" onClick={resetToPicker}>{t.newQuiz}</button>
        </div>
      </div>
    </div>
  );
}
