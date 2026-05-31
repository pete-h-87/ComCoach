import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../lib/lang";
import "./LearningSession.css";
import "./WordList.css";

const TEXT = {
  en: {
    title: "My Word List",
    subtitle: "Words you double-clicked across all your saved Learning Sessions.",
    loading: "Loading…",
    failed: "Failed to load. Is the server running?",
    empty: "No words saved yet. Save a Learning Session with highlighted words to start your list.",
    showNorwegian: "Show Norwegian",
    showEnglish: "Show English",
    fromSession: "From session:",
    practice: "Practice →",
  },
  no: {
    title: "Min ordliste",
    subtitle: "Ord du har dobbeltklikket på i alle dine lagrede læringsøkter.",
    loading: "Laster…",
    failed: "Kunne ikke laste. Kjører serveren?",
    empty: "Ingen ord lagret ennå. Lagre en læringsøkt med markerte ord for å starte listen din.",
    showNorwegian: "Vis norsk",
    showEnglish: "Vis engelsk",
    fromSession: "Fra økt:",
    practice: "Øv →",
  },
};

interface SavedWord {
  id: number;
  word: string;
  definitionNo: string;
  definitionEn: string;
  sessionId: number;
  sessionTheme: string | null;
  createdAt: string;
}

const ANNOTATION_COLORS = [
  "#e63946",
  "#f77f00",
  "#06a77d",
  "#0077b6",
  "#7209b7",
  "#588157",
  "#d62828",
  "#2a9d8f",
];

function colorForWord(word: string): string {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash * 31 + word.charCodeAt(i)) | 0;
  }
  return ANNOTATION_COLORS[Math.abs(hash) % ANNOTATION_COLORS.length];
}

export default function WordList() {
  const { lang } = useLang();
  const t = TEXT[lang];
  const navigate = useNavigate();
  const [words, setWords] = useState<SavedWord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [activeWord, setActiveWord] = useState<SavedWord | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);

  useEffect(() => {
    fetch("/api/words")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        setWords(data.words);
        setStatus("ready");
      })
      .catch(() => setStatus("failed"));
  }, []);

  const openWord = (w: SavedWord) => {
    setActiveWord(w);
    setShowEnglish(false);
  };

  return (
    <div className="word-list-page">
      <h2>{t.title}</h2>
      <p className="word-list-subtitle">{t.subtitle}</p>

      {status === "loading" && <p className="word-list-empty">{t.loading}</p>}
      {status === "failed" && (
        <p className="word-list-empty">{t.failed}</p>
      )}
      {status === "ready" && words.length === 0 && (
        <p className="word-list-empty">{t.empty}</p>
      )}

      {status === "ready" && words.length > 0 && (
        <div className="word-list-grid">
          {words.map((w) => (
            <button
              key={w.id}
              className="word-chip"
              style={{ borderBottomColor: colorForWord(w.word) }}
              onClick={() => openWord(w)}
            >
              <span>{w.word}</span>
            </button>
          ))}
        </div>
      )}

      {activeWord && (
        <div className="word-popup-backdrop" onClick={() => setActiveWord(null)}>
          <div
            className="annotation-card word-popup-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="annotation-header">
              <strong
                className="annotation-word"
                style={{ color: colorForWord(activeWord.word) }}
              >
                {activeWord.word}
              </strong>
              <button
                className="annotation-lang-toggle"
                onClick={() => setShowEnglish((v) => !v)}
                title={showEnglish ? t.showNorwegian : t.showEnglish}
              >
                {showEnglish ? "EN" : "NO"}
              </button>
              <button
                className="annotation-close"
                onClick={() => setActiveWord(null)}
              >
                &times;
              </button>
            </div>
            <div className="annotation-body">
              {showEnglish ? activeWord.definitionEn : activeWord.definitionNo}
            </div>
            <button
              className="word-popup-practice"
              onClick={() => navigate("/sentences", { state: { word: activeWord.word } })}
            >
              {t.practice}
            </button>
            {activeWord.sessionTheme && (
              <div className="word-popup-context">
                {t.fromSession} {activeWord.sessionTheme}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
