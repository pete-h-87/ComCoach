import { useEffect, useState } from "react";
import { useLang } from "../lib/lang";
import "./Stats.css";

interface QuizAttempt {
  id: number;
  quizType: string;
  difficulty: string;
  theme: string | null;
  total: number;
  correct: number;
  createdAt: string;
}

interface EssayAttemptSummary {
  id: number;
  targetLevel: string;
  achievedLevel: string;
  topic: string;
  feedback: string | null;
  createdAt: string;
}

interface EssayNote {
  issue: string;
  suggestion: string;
}

interface EssayAttemptDetail extends EssayAttemptSummary {
  essayText: string;
  correctedText: string;
  nextLevelText?: string;
  notes?: EssayNote[];
}

const NEXT_LEVEL: Record<string, string> = { A1: "A2", A2: "B1", B1: "B2" };

const TEXT = {
  en: {
    title: "Scores & History",
    quizzesHeader: "Quizzes",
    essaysHeader: "Essays",
    loading: "Loading…",
    failed: "Failed to load.",
    noQuizzes: "No quiz attempts yet — finish a quiz to see your scores here.",
    noEssays: "No essay attempts yet — submit one for grading to see it here.",
    statTotalQuizzes: "Quizzes Taken",
    statAverage: "Average Score",
    statBest: "Best Score",
    statTotalEssays: "Essays Submitted",
    statHighest: "Highest Level",
    typeRecent: "Recent",
    typeRandom: "Random",
    typeTheme: "Theme",
    diffBeginner: "Beginner",
    diffExpert: "Expert",
    aimedFor: "aimed for",
    yourEssay: "Your Essay",
    correctedVersion: "Corrected Version",
    nextLevelLabel: (lvl: string) => `Next-Level Example (${lvl})`,
    feedbackLabel: "Feedback",
    notesLabel: "Improvement Notes",
    topicLabel: "Topic",
  },
  no: {
    title: "Resultater & Historikk",
    quizzesHeader: "Quizer",
    essaysHeader: "Essayer",
    loading: "Laster…",
    failed: "Kunne ikke laste.",
    noQuizzes: "Ingen quiz-forsøk ennå — fullfør en quiz for å se resultatene her.",
    noEssays: "Ingen essay-forsøk ennå — send inn et for å se det her.",
    statTotalQuizzes: "Antall quizer",
    statAverage: "Gjennomsnittlig poeng",
    statBest: "Beste resultat",
    statTotalEssays: "Innsendte essayer",
    statHighest: "Høyeste nivå",
    typeRecent: "Siste",
    typeRandom: "Tilfeldig",
    typeTheme: "Tema",
    diffBeginner: "Nybegynner",
    diffExpert: "Ekspert",
    aimedFor: "siktet på",
    yourEssay: "Ditt essay",
    correctedVersion: "Korrigert versjon",
    nextLevelLabel: (lvl: string) => `Eksempel på neste nivå (${lvl})`,
    feedbackLabel: "Tilbakemelding",
    notesLabel: "Forbedringspunkter",
    topicLabel: "Emne",
  },
};

function formatDate(iso: string, lang: "en" | "no"): string {
  const locale = lang === "no" ? "nb-NO" : undefined;
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function bestLevel(levels: string[]): string {
  const order = ["A1", "A2", "B1", "B2"];
  let best = "";
  for (const l of levels) {
    if (order.indexOf(l) > order.indexOf(best || "A1")) best = l;
  }
  return best || "—";
}

export default function Stats() {
  const { lang } = useLang();
  const t = TEXT[lang];
  const [quizzes, setQuizzes] = useState<QuizAttempt[] | null>(null);
  const [essays, setEssays] = useState<EssayAttemptSummary[] | null>(null);
  const [error, setError] = useState("");
  const [expandedEssay, setExpandedEssay] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, EssayAttemptDetail>>({});

  useEffect(() => {
    fetch("/api/quiz/attempts")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setQuizzes(data.attempts ?? []))
      .catch(() => {
        setError(t.failed);
        setQuizzes([]);
      });

    fetch("/api/essay/attempts")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setEssays(data.attempts ?? []))
      .catch(() => {
        setError(t.failed);
        setEssays([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleEssay = async (id: number) => {
    if (expandedEssay === id) {
      setExpandedEssay(null);
      return;
    }
    setExpandedEssay(id);
    if (!details[id]) {
      try {
        const res = await fetch(`/api/essay/attempts/${id}`);
        if (res.ok) {
          const data: EssayAttemptDetail = await res.json();
          setDetails((prev) => ({ ...prev, [id]: data }));
        }
      } catch {
        // silent
      }
    }
  };

  const typeLabel = (type: string) => {
    if (type === "recent") return t.typeRecent;
    if (type === "random") return t.typeRandom;
    if (type === "theme") return t.typeTheme;
    return type;
  };

  const diffLabel = (d: string) =>
    d === "beginner" ? t.diffBeginner : d === "expert" ? t.diffExpert : d;

  const totalQuizzes = quizzes?.length ?? 0;
  const avgScore =
    quizzes && quizzes.length > 0
      ? Math.round(
          (quizzes.reduce((s, q) => s + q.correct / q.total, 0) / quizzes.length) * 100
        )
      : 0;
  const bestScore =
    quizzes && quizzes.length > 0
      ? Math.max(...quizzes.map((q) => Math.round((q.correct / q.total) * 100)))
      : 0;

  const totalEssays = essays?.length ?? 0;
  const highest = essays && essays.length > 0 ? bestLevel(essays.map((e) => e.achievedLevel)) : "—";

  return (
    <div className="stats-page">
      <h2 className="stats-title">{t.title}</h2>
      {error && <p className="stats-error">{error}</p>}

      <div className="stats-section">
        <h3>{t.quizzesHeader}</h3>
        {quizzes === null ? (
          <p className="stats-loading">{t.loading}</p>
        ) : quizzes.length === 0 ? (
          <p className="stats-empty">{t.noQuizzes}</p>
        ) : (
          <>
            <div className="stats-summary">
              <div className="stats-stat">
                <div className="stats-stat-label">{t.statTotalQuizzes}</div>
                <div className="stats-stat-value">{totalQuizzes}</div>
              </div>
              <div className="stats-stat">
                <div className="stats-stat-label">{t.statAverage}</div>
                <div className="stats-stat-value">{avgScore}%</div>
              </div>
              <div className="stats-stat">
                <div className="stats-stat-label">{t.statBest}</div>
                <div className="stats-stat-value">{bestScore}%</div>
              </div>
            </div>
            <ul className="stats-list">
              {quizzes.map((q) => (
                <li key={q.id} className="stats-row">
                  <span className="stats-row-mark">
                    {q.correct}/{q.total}
                    <span className="stats-row-pct">{Math.round((q.correct / q.total) * 100)}%</span>
                  </span>
                  <div className="stats-row-meta">
                    <span className="stats-row-primary">
                      {typeLabel(q.quizType)}
                      {q.theme ? ` · ${q.theme}` : ""}
                    </span>
                    <span className="stats-row-secondary">{diffLabel(q.difficulty)}</span>
                  </div>
                  <span className="stats-row-date">{formatDate(q.createdAt, lang)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="stats-section">
        <h3>{t.essaysHeader}</h3>
        {essays === null ? (
          <p className="stats-loading">{t.loading}</p>
        ) : essays.length === 0 ? (
          <p className="stats-empty">{t.noEssays}</p>
        ) : (
          <>
            <div className="stats-summary">
              <div className="stats-stat">
                <div className="stats-stat-label">{t.statTotalEssays}</div>
                <div className="stats-stat-value">{totalEssays}</div>
              </div>
              <div className="stats-stat">
                <div className="stats-stat-label">{t.statHighest}</div>
                <div className="stats-stat-value">{highest}</div>
              </div>
            </div>
            <ul className="stats-list">
              {essays.map((e) => {
                const isOpen = expandedEssay === e.id;
                const detail = details[e.id];
                return (
                  <li key={e.id} className="stats-essay-row">
                    <button className="stats-essay-summary" onClick={() => toggleEssay(e.id)}>
                      <span className={`stats-row-mark stats-row-mark--${e.achievedLevel}`}>
                        {e.achievedLevel}
                      </span>
                      <div className="stats-row-meta">
                        <span className="stats-row-primary">{e.topic}</span>
                        <span className="stats-row-secondary">
                          {t.aimedFor} {e.targetLevel}
                        </span>
                      </div>
                      <span className="stats-row-date">{formatDate(e.createdAt, lang)}</span>
                    </button>
                    {isOpen && (
                      <div className="stats-essay-detail">
                        {!detail ? (
                          <p className="stats-loading" style={{ color: "#5b6878" }}>{t.loading}</p>
                        ) : (
                          <>
                            {detail.feedback && (
                              <div className="stats-essay-block">
                                <h4>{t.feedbackLabel}</h4>
                                <div className="stats-essay-feedback">{detail.feedback}</div>
                              </div>
                            )}
                            <div className="stats-essay-block">
                              <h4>{t.yourEssay}</h4>
                              <div className="stats-essay-text">{detail.essayText}</div>
                            </div>
                            <div className="stats-essay-block">
                              <h4>{t.correctedVersion}</h4>
                              <div className="stats-essay-text">{detail.correctedText}</div>
                            </div>
                            {detail.nextLevelText && NEXT_LEVEL[detail.achievedLevel] && (
                              <div className="stats-essay-block stats-essay-block--next">
                                <h4>{t.nextLevelLabel(NEXT_LEVEL[detail.achievedLevel])}</h4>
                                <div className="stats-essay-text">{detail.nextLevelText}</div>
                              </div>
                            )}
                            {detail.notes && detail.notes.length > 0 && (
                              <div className="stats-essay-block">
                                <h4>{t.notesLabel}</h4>
                                <ul className="stats-essay-notes">
                                  {detail.notes.map((n, i) => (
                                    <li key={i} className="stats-essay-note">
                                      <span className="stats-essay-note-issue">{n.issue}</span>
                                      <span className="stats-essay-note-suggestion">{n.suggestion}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
