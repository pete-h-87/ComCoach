import { useEffect, useState } from "react";
import { useLang } from "../lib/lang";
import "./Essay.css";

type Level = "A1" | "A2" | "B1" | "B2";

const TEXT = {
  en: {
    title: "Short Essay",
    targetLevel: "Target Level",
    topic: "Topic",
    generating: "Generating a prompt…",
    newPrompt: "New Prompt",
    placeholder: "Write a paragraph in Norwegian… (5-8 sentences)",
    wordsLabel: (n: number) => `${n} words`,
    submit: "Submit for Grading",
    grading: "Grading…",
    correctedTitle: "Corrected Version",
    notesTitle: "Notes",
    tryAnother: "Try Another Prompt",
    rewriteSame: "Rewrite Same Prompt",
    failedPrompt: "Failed to get a prompt.",
    networkError: "Network error.",
    failedGrade: "Grading failed.",
    networkGrade: "Network error during grading.",
  },
  no: {
    title: "Kort essay",
    targetLevel: "Målnivå",
    topic: "Emne",
    generating: "Genererer et emne…",
    newPrompt: "Nytt emne",
    placeholder: "Skriv et avsnitt på norsk… (5-8 setninger)",
    wordsLabel: (n: number) => `${n} ord`,
    submit: "Send inn for vurdering",
    grading: "Vurderer…",
    correctedTitle: "Korrigert versjon",
    notesTitle: "Notater",
    tryAnother: "Prøv et annet emne",
    rewriteSame: "Skriv om samme emne",
    failedPrompt: "Kunne ikke hente et emne.",
    networkError: "Nettverksfeil.",
    failedGrade: "Vurdering mislyktes.",
    networkGrade: "Nettverksfeil under vurdering.",
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
  notes: GradeNote[];
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

  const fetchPrompt = async (level: Level) => {
    setLoadingPrompt(true);
    setError("");
    setResult(null);
    setEssay("");
    try {
      const res = await fetch("/api/essay/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
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
    fetchPrompt(targetLevel);
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
        }),
      }).catch(() => {
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
            onClick={() => {
              setTargetLevel(lvl);
              fetchPrompt(lvl);
            }}
            disabled={loadingPrompt || grading}
          >
            {lvl}
          </button>
        ))}
      </div>

      {loadingPrompt && <p className="essay-status">{t.generating}</p>}

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
    </div>
  );
}
