import { useEffect, useState, useCallback } from "react";
import { useLang } from "../lib/lang";
import "./Review.css";

const TEXT = {
  en: {
    title: "Review",
    untitled: "Untitled session",
    failed: "Failed to load sessions",
    loading: "Loading sessions...",
    loadingDot: "Loading…",
    empty: "No saved sessions yet. Start a learning session and save one.",
    highlightedWords: "Highlighted words",
    noWords: "No words highlighted.",
  },
  no: {
    title: "Gjennomgang",
    untitled: "Økt uten tittel",
    failed: "Kunne ikke laste økter",
    loading: "Laster økter...",
    loadingDot: "Laster…",
    empty: "Ingen lagrede økter ennå. Start en læringsøkt og lagre en.",
    highlightedWords: "Markerte ord",
    noWords: "Ingen markerte ord.",
  },
};

interface SessionSummary {
  id: number;
  sessionTheme: string | null;
  text: string;
  createdAt: string;
}

interface SessionWord {
  id: number;
  word: string;
  definitionNo: string;
  definitionEn: string;
}

interface SessionDetail extends SessionSummary {
  words: SessionWord[];
}

function formatDate(iso: string, lang: "en" | "no"): string {
  const locale = lang === "no" ? "nb-NO" : undefined;
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Review() {
  const { lang } = useLang();
  const t = TEXT[lang];
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, SessionDetail>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setSessions(data.sessions))
      .catch(() => setError(t.failed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(
    async (id: number) => {
      if (expandedId === id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(id);
      if (!details[id]) {
        setLoadingId(id);
        try {
          const res = await fetch(`/api/sessions/${id}`);
          if (res.ok) {
            const data: SessionDetail = await res.json();
            setDetails((prev) => ({ ...prev, [id]: data }));
          }
        } finally {
          setLoadingId(null);
        }
      }
    },
    [expandedId, details]
  );

  if (error) return <div className="review-page"><p className="review-error">{error}</p></div>;
  if (!sessions) return <div className="review-page"><p className="review-loading">{t.loading}</p></div>;
  if (sessions.length === 0) {
    return (
      <div className="review-page">
        <h2 className="review-title">{t.title}</h2>
        <p className="review-empty">{t.empty}</p>
      </div>
    );
  }

  return (
    <div className="review-page">
      <h2 className="review-title">{t.title}</h2>
      <ul className="session-list">
        {sessions.map((s) => {
          const isOpen = expandedId === s.id;
          const detail = details[s.id];
          return (
            <li key={s.id} className={`session-item${isOpen ? " session-item--open" : ""}`}>
              <button className="session-header" onClick={() => toggle(s.id)}>
                <span className="session-theme-label">
                  {s.sessionTheme || <em>{t.untitled}</em>}
                </span>
                <span className="session-date">{formatDate(s.createdAt, lang)}</span>
                <span className={`session-chevron${isOpen ? " session-chevron--open" : ""}`}>
                  ▸
                </span>
              </button>
              {isOpen && (
                <div className="session-body">
                  {loadingId === s.id && !detail ? (
                    <p className="review-loading">{t.loadingDot}</p>
                  ) : detail ? (
                    <div className="session-content">
                      <div className="session-text">
                        {detail.text.split(/\n\s*\n/).map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                      <aside className="session-words">
                        <h4>{t.highlightedWords}</h4>
                        {detail.words.length === 0 ? (
                          <p className="session-words-empty">{t.noWords}</p>
                        ) : (
                          <ul>
                            {detail.words.map((w) => (
                              <li key={w.id} className="session-word">
                                <strong>{w.word}</strong>
                                <span className="session-word-en">{w.definitionEn}</span>
                                <span className="session-word-no">{w.definitionNo}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </aside>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
