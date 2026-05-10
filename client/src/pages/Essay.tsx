import { useEffect, useState } from "react";
import { useLang } from "../lib/lang";
import "./Essay.css";

type Level = "A1" | "A2" | "B1" | "B2";

const TEXT = {
  en: {
    title: "Short Essay",
    targetLevel: "Target Level",
    subject: "Subject",
    anySubject: "Random Question",
    generateQuestion: "Generate Question",
    topic: "Topic",
    generating: "Generating a prompt…",
    newPrompt: "New Prompt",
    placeholder: "Write a paragraph in Norwegian… (5-8 sentences)",
    wordsLabel: (n: number) => `${n} words`,
    submit: "Submit for Grading",
    grading: "Grading…",
    correctedTitle: "Corrected Version",
    nextLevelTitle: (lvl: string) => `Next-Level Example (${lvl})`,
    notesTitle: "Notes",
    yourEssay: "Your Essay",
    feedbackLabel: "Feedback",
    loadingDetail: "Loading…",
    tryAnother: "Try Another Prompt",
    rewriteSame: "Rewrite Same Prompt",
    failedPrompt: "Failed to get a prompt.",
    networkError: "Network error.",
    failedGrade: "Grading failed.",
    networkGrade: "Network error during grading.",
    recentEssays: "Recent Essays",
    aimedFor: "aimed for",
  },
  no: {
    title: "Kort essay",
    targetLevel: "Målnivå",
    subject: "Tema",
    anySubject: "Tilfeldig spørsmål",
    generateQuestion: "Generer spørsmål",
    topic: "Emne",
    generating: "Genererer et emne…",
    newPrompt: "Nytt emne",
    placeholder: "Skriv et avsnitt på norsk… (5-8 setninger)",
    wordsLabel: (n: number) => `${n} ord`,
    submit: "Send inn for vurdering",
    grading: "Vurderer…",
    correctedTitle: "Korrigert versjon",
    nextLevelTitle: (lvl: string) => `Eksempel på neste nivå (${lvl})`,
    notesTitle: "Notater",
    yourEssay: "Ditt essay",
    feedbackLabel: "Tilbakemelding",
    loadingDetail: "Laster…",
    tryAnother: "Prøv et annet emne",
    rewriteSame: "Skriv om samme emne",
    failedPrompt: "Kunne ikke hente et emne.",
    networkError: "Nettverksfeil.",
    failedGrade: "Vurdering mislyktes.",
    networkGrade: "Nettverksfeil under vurdering.",
    recentEssays: "Siste essayer",
    aimedFor: "siktet på",
  },
};

interface PromptData {
  prompt: string;
  promptEn: string;
}

interface GradeNote {
  issue: string;
  suggestion: string;
}

interface GradeResult {
  level: Level;
  feedback: string;
  correctedText: string;
  nextLevelText: string;
  notes: GradeNote[];
}

const NEXT_LEVEL: Record<Level, Level | null> = {
  A1: "A2",
  A2: "B1",
  B1: "B2",
  B2: null,
};

interface RecentEssay {
  id: number;
  targetLevel: Level;
  achievedLevel: Level;
  topic: string;
  createdAt: string;
}

interface EssayDetail extends RecentEssay {
  essayText: string;
  correctedText: string;
  feedback: string | null;
  nextLevelText?: string;
  notes?: GradeNote[];
}

const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

export default function Essay() {
  const { lang } = useLang();
  const t = TEXT[lang];
  const [targetLevel, setTargetLevel] = useState<Level>("B1");
  const [prompt, setPrompt] = useState<PromptData | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [essay, setEssay] = useState("");
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState("");
  const [recentEssays, setRecentEssays] = useState<RecentEssay[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState("");
  const [expandedEssayId, setExpandedEssayId] = useState<number | null>(null);
  const [essayDetails, setEssayDetails] = useState<Record<number, EssayDetail>>({});

  const loadRecentEssays = () => {
    fetch("/api/essay/attempts")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setRecentEssays((data.attempts ?? []).slice(0, 5)))
      .catch(() => {
        // Non-fatal
      });
  };

  const toggleEssayExpand = async (id: number) => {
    if (expandedEssayId === id) {
      setExpandedEssayId(null);
      return;
    }
    setExpandedEssayId(id);
    if (!essayDetails[id]) {
      try {
        const res = await fetch(`/api/essay/attempts/${id}`);
        if (res.ok) {
          const data: EssayDetail = await res.json();
          setEssayDetails((prev) => ({ ...prev, [id]: data }));
        }
      } catch {
        // silent
      }
    }
  };

  const fetchPrompt = async (level: Level, theme: string = selectedTheme) => {
    setLoadingPrompt(true);
    setError("");
    setResult(null);
    setEssay("");
    try {
      const res = await fetch("/api/essay/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, theme: theme || undefined }),
      });
      if (!res.ok) {
        setError(t.failedPrompt);
        setPrompt(null);
        return;
      }
      const data = await res.json();
      setPrompt({ prompt: data.prompt ?? "", promptEn: data.promptEn ?? "" });
    } catch {
      setError(t.networkError);
      setPrompt(null);
    } finally {
      setLoadingPrompt(false);
    }
  };

  useEffect(() => {
    loadRecentEssays();
    fetch("/api/themes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setThemes(data.themes ?? []))
      .catch(() => {
        // Non-fatal — themes just won't be available
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitEssay = async () => {
    if (!prompt || !essay.trim() || grading) return;
    setGrading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/essay/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: prompt.prompt, essay }),
      });
      if (!res.ok) {
        setError(t.failedGrade);
        return;
      }
      const data: GradeResult = await res.json();
      setResult(data);
      // Fire-and-forget record of this attempt.
      fetch("/api/essay/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLevel,
          achievedLevel: data.level,
          topic: prompt.prompt,
          essayText: essay,
          correctedText: data.correctedText,
          feedback: data.feedback,
          notes: data.notes,
          nextLevelText: data.nextLevelText,
        }),
      }).then(() => loadRecentEssays()).catch(() => {
        // Silent — scoring failure shouldn't block the UI.
      });
    } catch {
      setError(t.networkGrade);
    } finally {
      setGrading(false);
    }
  };

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  return (
    <div className="essay-page">
      <h2 className="essay-title">{t.title}</h2>

      <p className="essay-section-label">{t.targetLevel}</p>
      <div className="essay-level-row">
        {LEVELS.map((lvl) => (
          <button
            key={lvl}
            className={`essay-level-btn ${
              targetLevel === lvl ? "essay-level-btn--selected" : ""
            }`}
            onClick={() => setTargetLevel(lvl)}
            disabled={loadingPrompt || grading}
          >
            {lvl}
          </button>
        ))}
      </div>

      <p className="essay-section-label">{t.subject}</p>
      <div className="essay-subject-row">
        <select
          className="essay-subject-select"
          value={selectedTheme}
          onChange={(e) => setSelectedTheme(e.target.value)}
          disabled={loadingPrompt || grading}
        >
          <option value="">{t.anySubject}</option>
          {themes.map((th) => (
            <option key={th} value={th}>{th}</option>
          ))}
        </select>
        <button
          className="essay-button essay-button-primary"
          onClick={() => fetchPrompt(targetLevel, selectedTheme)}
          disabled={loadingPrompt || grading}
        >
          {loadingPrompt ? t.generating : t.generateQuestion}
        </button>
      </div>

      {prompt && !loadingPrompt && (
        <>
          <div className="essay-prompt-card">
            <p className="essay-section-label" style={{ color: "#6b7a8e", margin: 0 }}>
              {t.topic}
            </p>
            <div className="essay-prompt-text">{prompt.prompt}</div>
            {prompt.promptEn && (
              <div className="essay-prompt-en">{prompt.promptEn}</div>
            )}
            <div className="essay-prompt-actions">
              <button
                className="essay-button essay-button-secondary"
                onClick={() => fetchPrompt(targetLevel)}
                disabled={grading}
              >
                {t.newPrompt}
              </button>
            </div>
          </div>

          <div className="essay-editor">
            <textarea
              className="essay-textarea"
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder={t.placeholder}
              disabled={grading || !!result}
            />
            <div className="essay-meta-row">
              <span className="essay-word-count">{t.wordsLabel(wordCount)}</span>
              <button
                className="essay-button essay-button-primary"
                onClick={submitEssay}
                disabled={grading || !!result || !essay.trim()}
              >
                {grading ? t.grading : t.submit}
              </button>
            </div>
          </div>
        </>
      )}

      {error && <p className="essay-status essay-error">{error}</p>}

      {result && (
        <div className="essay-result">
          <div className="essay-result-header">
            <span className={`essay-level-badge essay-level-badge--${result.level}`}>
              {result.level}
            </span>
            <p className="essay-feedback">{result.feedback}</p>
          </div>

          {result.correctedText && (
            <div className="essay-card">
              <h4>{t.correctedTitle}</h4>
              <div className="essay-corrected">{result.correctedText}</div>
            </div>
          )}

          {result.nextLevelText && NEXT_LEVEL[result.level] && (
            <div className="essay-card essay-card--next">
              <h4>{t.nextLevelTitle(NEXT_LEVEL[result.level] as string)}</h4>
              <div className="essay-corrected">{result.nextLevelText}</div>
            </div>
          )}

          {result.notes.length > 0 && (
            <div className="essay-card">
              <h4>{t.notesTitle}</h4>
              <ul className="essay-notes">
                {result.notes.map((n, i) => (
                  <li key={i} className="essay-note">
                    <span className="essay-note-issue">{n.issue}</span>
                    <span className="essay-note-suggestion">{n.suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="essay-prompt-actions">
            <button
              className="essay-button essay-button-primary"
              onClick={() => fetchPrompt(targetLevel)}
            >
              {t.tryAnother}
            </button>
            <button
              className="essay-button essay-button-secondary"
              onClick={() => {
                setResult(null);
                setEssay("");
              }}
            >
              {t.rewriteSame}
            </button>
          </div>
        </div>
      )}

      {recentEssays.length > 0 && (
        <div className="essay-recent">
          <p className="essay-section-label">{t.recentEssays}</p>
          <ul className="essay-recent-list">
            {recentEssays.map((r) => {
              const isOpen = expandedEssayId === r.id;
              const detail = essayDetails[r.id];
              return (
                <li key={r.id} className="essay-recent-row">
                  <button
                    type="button"
                    className="essay-recent-summary"
                    onClick={() => toggleEssayExpand(r.id)}
                    aria-expanded={isOpen}
                  >
                    <span className={`essay-recent-level essay-recent-level--${r.achievedLevel}`}>
                      {r.achievedLevel}
                    </span>
                    <div className="essay-recent-meta">
                      <span className="essay-recent-topic">{r.topic}</span>
                      <span className="essay-recent-aim">
                        {t.aimedFor} {r.targetLevel}
                      </span>
                    </div>
                    <span className="essay-recent-date">
                      {new Date(r.createdAt).toLocaleDateString(
                        lang === "no" ? "nb-NO" : undefined,
                        { month: "short", day: "numeric" }
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="essay-recent-detail">
                      {!detail ? (
                        <p className="essay-status">{t.loadingDetail}</p>
                      ) : (
                        <>
                          {detail.feedback && (
                            <div className="essay-card">
                              <h4>{t.feedbackLabel}</h4>
                              <div className="essay-corrected">{detail.feedback}</div>
                            </div>
                          )}
                          <div className="essay-card">
                            <h4>{t.yourEssay}</h4>
                            <div className="essay-corrected">{detail.essayText}</div>
                          </div>
                          <div className="essay-card">
                            <h4>{t.correctedTitle}</h4>
                            <div className="essay-corrected">{detail.correctedText}</div>
                          </div>
                          {detail.nextLevelText &&
                            NEXT_LEVEL[detail.achievedLevel] && (
                              <div className="essay-card essay-card--next">
                                <h4>
                                  {t.nextLevelTitle(
                                    NEXT_LEVEL[detail.achievedLevel] as string
                                  )}
                                </h4>
                                <div className="essay-corrected">
                                  {detail.nextLevelText}
                                </div>
                              </div>
                            )}
                          {detail.notes && detail.notes.length > 0 && (
                            <div className="essay-card">
                              <h4>{t.notesTitle}</h4>
                              <ul className="essay-notes">
                                {detail.notes.map((n, i) => (
                                  <li key={i} className="essay-note">
                                    <span className="essay-note-issue">{n.issue}</span>
                                    <span className="essay-note-suggestion">
                                      {n.suggestion}
                                    </span>
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
        </div>
      )}
    </div>
  );
}
