import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLang } from "../lib/lang";
import "./Sentences.css";

const TEXT = {
  en: {
    title: "Sentences",
    subtitle: "Practice using a word in a sentence. Write in Norwegian.",
    wordLabel: "Word",
    wordPlaceholder: "Type a word to practice…",
    sentenceLabel: "Your sentence",
    sentencePlaceholder: "Write a sentence using this word…",
    submit: "Check",
    checking: "Checking…",
    correct: "Correct!",
    incorrect: "Not quite",
    correctedLabel: "Corrected",
    feedbackLabel: "Feedback",
    tryAnother: "Try Another Sentence",
    changeWord: "Change Word",
    failed: "Check failed. Try again.",
    networkError: "Network error.",
    pickFromList: "or pick from your word list →",
    wordButton1: "Random word",
    wordButton2: "Choose word",
  },
  no: {
    title: "Setninger",
    subtitle: "Øv på å bruke et ord i en setning. Skriv på norsk.",
    wordLabel: "Ord",
    wordPlaceholder: "Skriv et ord å øve på…",
    sentenceLabel: "Din setning",
    sentencePlaceholder: "Skriv en setning med dette ordet…",
    submit: "Sjekk",
    checking: "Sjekker…",
    correct: "Riktig!",
    incorrect: "Ikke helt",
    correctedLabel: "Korrigert",
    feedbackLabel: "Tilbakemelding",
    tryAnother: "Prøv en annen setning",
    changeWord: "Bytt ord",
    failed: "Sjekk mislyktes. Prøv igjen.",
    networkError: "Nettverksfeil.",
    pickFromList: "eller velg fra ordlisten din →",
    wordButton1: "Tilfeldig ord",
    wordButton2: "Velg ord",
  },
};

interface CheckResult {
  correct: boolean;
  correctedSentence: string;
  feedback: string;
}

export default function Sentences() {
  const { lang } = useLang();
  const t = TEXT[lang];
  const location = useLocation();
  const navigate = useNavigate();

  const [word, setWord] = useState("");
  const [sentence, setSentence] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");

  // Accept a word passed via navigation state (e.g. from Word List)
  useEffect(() => {
    const incoming = (location.state as { word?: string } | null)?.word;
    if (typeof incoming === "string" && incoming.trim()) {
      setWord(incoming.trim());
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleRandomWord = () => {
    
  };

  const handlePickWord = () => {
    navigate("/word-list");
  };

  const handleSubmit = async () => {
    if (!word.trim() || !sentence.trim() || checking) return;
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/sentences/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim(), sentence: sentence.trim() }),
      });
      if (!res.ok) {
        setError(t.failed);
        return;
      }
      const data: CheckResult = await res.json();
      setResult(data);
    } catch {
      setError(t.networkError);
    } finally {
      setChecking(false);
    }
  };

  const resetSentence = () => {
    setSentence("");
    setResult(null);
    setError("");
  };

  const resetAll = () => {
    setWord("");
    setSentence("");
    setResult(null);
    setError("");
  };

  return (
    <div className="sentences-page">
      <h2 className="sentences-title">{t.title}</h2>
      <p className="sentences-subtitle">{t.subtitle}</p>

      <div className="sentences-form">
        <div className="sentences-field">
          <label className="sentences-label">{t.wordLabel}</label>
          <div className="sentences-word-row">
            <input
              className="sentences-input"
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={t.wordPlaceholder}
              disabled={checking || !!result}
            />
            {/* <a className="sentences-pick-link" href="/word-list">
              {t.pickFromList}
            </a> */}
          </div>
          <div className="sentences-word-buttons">
            <button
              type="button"
              className="sentences-word-button"
              onClick={handleRandomWord}
            >
              {t.wordButton1}
            </button>
            <button
              type="button"
              className="sentences-word-button"
              onClick={handlePickWord}
            >
              {t.wordButton2}
            </button>
          </div>
        </div>

        {word.trim() && (
          <div className="sentences-field">
            <label className="sentences-label">{t.sentenceLabel}</label>
            <textarea
              className="sentences-textarea"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              placeholder={t.sentencePlaceholder}
              disabled={checking || !!result}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !result && !checking) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {!result && (
              <button
                className="sentences-submit"
                onClick={handleSubmit}
                disabled={checking || !sentence.trim()}
              >
                {checking ? t.checking : t.submit}
              </button>
            )}
          </div>
        )}

        {error && <p className="sentences-error">{error}</p>}

        {result && (
          <div
            className={`sentences-result ${result.correct ? "sentences-result--correct" : "sentences-result--incorrect"}`}
          >
            <div className="sentences-verdict">
              {result.correct ? t.correct : t.incorrect}
            </div>

            {!result.correct && result.correctedSentence && (
              <div className="sentences-corrected">
                <span className="sentences-result-label">
                  {t.correctedLabel}:
                </span>
                <p>{result.correctedSentence}</p>
              </div>
            )}

            <div className="sentences-feedback">
              <span className="sentences-result-label">{t.feedbackLabel}:</span>
              <p>{result.feedback}</p>
            </div>

            <div className="sentences-actions">
              <button className="sentences-submit" onClick={resetSentence}>
                {t.tryAnother}
              </button>
              <button
                className="sentences-submit sentences-submit--secondary"
                onClick={resetAll}
              >
                {t.changeWord}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
