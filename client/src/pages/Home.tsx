import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../lib/lang";
import "./Home.css";

interface SessionSummary {
  id: number;
  sessionTheme: string | null;
  createdAt: string;
}

interface WordSummary {
  word: string;
  sessionTheme: string | null;
  createdAt: string;
}

interface QuizAttempt {
  total: number;
  correct: number;
}

interface EssayAttempt {
  achievedLevel: string;
}

const TEXT = {
  en: {
    title: "Welcome back",
    subtitle: "Pick up where you left off, or start something new.",
    untitled: "Untitled",
    learningTitle: "Learning Session",
    learningCta: "Paste a Norwegian text and start reading.",
    learningLast: "Last session:",
    learningEmpty: "No sessions yet — read your first text.",
    reviewTitle: "Review",
    reviewSavedSession: "saved session",
    reviewSavedSessions: "saved sessions",
    reviewMostRecent: "Most recent:",
    reviewEmpty: "Save a session to see it here.",
    wordsTitle: "My Word List",
    wordsOne: "word saved",
    wordsMany: "words saved",
    wordsEmpty: "Double-click words during a session to build your list.",
    quizTitle: "Quiz",
    quizCtaReady: "Test yourself on recent, random, or themed words.",
    quizCtaPartial: (n: number) => `${n}/10 words — keep going to unlock a full quiz.`,
    quizCtaEmpty: "Save a session with words to start quizzing.",
    quizDetail1: "Beginner",
    quizDetail2: "Expert",
    quizDetailGlue: "defines in English",
    quizDetailGlue2: "in Norwegian.",
    essayTitle: "Short Essay",
    essayCta: "Write a paragraph on an AI-given topic, get a CEFR grade.",
    essayDetailPre: "Pick a level (",
    essayDetailMid: "), get a prompt, write, and receive corrections.",
    statsTitle: "Scores & History",
    statsCta: "Browse all your past quiz scores and essay submissions.",
    statsLastQuiz: "Last quiz:",
    statsLastEssay: "Last essay:",
    statsEmpty: "No scores yet — finish a quiz or essay to start your history.",
  },
  no: {
    title: "Velkommen tilbake",
    subtitle: "Fortsett der du slapp, eller start noe nytt.",
    untitled: "Uten tittel",
    learningTitle: "Læringsøkt",
    learningCta: "Lim inn en norsk tekst og begynn å lese.",
    learningLast: "Forrige økt:",
    learningEmpty: "Ingen økter ennå — les din første tekst.",
    reviewTitle: "Gjennomgang",
    reviewSavedSession: "lagret økt",
    reviewSavedSessions: "lagrede økter",
    reviewMostRecent: "Sist:",
    reviewEmpty: "Lagre en økt for å se den her.",
    wordsTitle: "Min ordliste",
    wordsOne: "ord lagret",
    wordsMany: "ord lagret",
    wordsEmpty: "Dobbeltklikk på ord under en økt for å bygge listen din.",
    quizTitle: "Quiz",
    quizCtaReady: "Test deg selv på nylige, tilfeldige eller tematiske ord.",
    quizCtaPartial: (n: number) => `${n}/10 ord — fortsett for å låse opp en hel quiz.`,
    quizCtaEmpty: "Lagre en økt med ord for å starte quiz.",
    quizDetail1: "Nybegynner",
    quizDetail2: "Ekspert",
    quizDetailGlue: "definerer på engelsk",
    quizDetailGlue2: "på norsk.",
    essayTitle: "Kort essay",
    essayCta: "Skriv et avsnitt om et AI-gitt emne, og få en CEFR-karakter.",
    essayDetailPre: "Velg et nivå (",
    essayDetailMid: "), få et emne, skriv, og motta korrigeringer.",
    statsTitle: "Resultater & Historikk",
    statsCta: "Se alle dine tidligere quiz-resultater og essay-innleveringer.",
    statsLastQuiz: "Forrige quiz:",
    statsLastEssay: "Forrige essay:",
    statsEmpty: "Ingen resultater ennå — fullfør en quiz eller et essay for å starte historikken.",
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

export default function Home() {
  const { lang } = useLang();
  const t = TEXT[lang];
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [words, setWords] = useState<WordSummary[] | null>(null);
  const [lastQuiz, setLastQuiz] = useState<QuizAttempt | null>(null);
  const [lastEssay, setLastEssay] = useState<EssayAttempt | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setSessions(data.sessions ?? []))
      .catch(() => setSessions([]));

    fetch("/api/words")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setWords(data.words ?? []))
      .catch(() => setWords([]));

    fetch("/api/quiz/attempts")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setLastQuiz(data.attempts?.[0] ?? null))
      .catch(() => {});

    fetch("/api/essay/attempts")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setLastEssay(data.attempts?.[0] ?? null))
      .catch(() => {});
  }, []);

  const sessionCount = sessions?.length ?? 0;
  const mostRecentSession = sessions?.[0];
  const wordCount = words?.length ?? 0;
  const recentWords = (words ?? []).slice(0, 6);

  return (
    <div className="home-page">
      <h2 className="home-title">{t.title}</h2>
      <p className="home-subtitle">{t.subtitle}</p>

      <div className="home-grid">
        <Link to="/learning-session" className="home-card home-card--learning">
          <div className="home-card-header">
            <h3 className="home-card-title">{t.learningTitle}</h3>
            <span className="home-card-arrow">→</span>
          </div>
          <div className="home-card-cta">{t.learningCta}</div>
          <div className="home-card-detail">
            {mostRecentSession ? (
              <>
                {t.learningLast}{" "}
                <span className="home-card-detail-strong">
                  {mostRecentSession.sessionTheme || t.untitled}
                </span>{" "}
                · {formatDate(mostRecentSession.createdAt, lang)}
              </>
            ) : (
              <span className="home-card-empty">{t.learningEmpty}</span>
            )}
          </div>
        </Link>

        <Link to="/review" className="home-card home-card--review">
          <div className="home-card-header">
            <h3 className="home-card-title">{t.reviewTitle}</h3>
            <span className="home-card-arrow">→</span>
          </div>
          <div className="home-card-stat">
            {sessionCount}
            <span className="home-card-stat-label">
              {sessionCount === 1 ? t.reviewSavedSession : t.reviewSavedSessions}
            </span>
          </div>
          <div className="home-card-detail">
            {mostRecentSession ? (
              <>
                {t.reviewMostRecent}{" "}
                <span className="home-card-detail-strong">
                  {mostRecentSession.sessionTheme || t.untitled}
                </span>
              </>
            ) : (
              <span className="home-card-empty">{t.reviewEmpty}</span>
            )}
          </div>
        </Link>

        <Link to="/word-list" className="home-card home-card--words">
          <div className="home-card-header">
            <h3 className="home-card-title">{t.wordsTitle}</h3>
            <span className="home-card-arrow">→</span>
          </div>
          <div className="home-card-stat">
            {wordCount}
            <span className="home-card-stat-label">
              {wordCount === 1 ? t.wordsOne : t.wordsMany}
            </span>
          </div>
          {recentWords.length > 0 ? (
            <div className="home-card-words">
              {recentWords.map((w) => (
                <span key={w.word} className="home-card-word">{w.word}</span>
              ))}
            </div>
          ) : (
            <div className="home-card-empty">{t.wordsEmpty}</div>
          )}
        </Link>

        <Link to="/quiz" className="home-card home-card--quiz">
          <div className="home-card-header">
            <h3 className="home-card-title">{t.quizTitle}</h3>
            <span className="home-card-arrow">→</span>
          </div>
          <div className="home-card-cta">
            {wordCount >= 10
              ? t.quizCtaReady
              : wordCount > 0
              ? t.quizCtaPartial(wordCount)
              : t.quizCtaEmpty}
          </div>
          <div className="home-card-detail">
            <span className="home-card-detail-strong">{t.quizDetail1}</span>{" "}
            {t.quizDetailGlue} ·{" "}
            <span className="home-card-detail-strong">{t.quizDetail2}</span>{" "}
            {t.quizDetailGlue2}
          </div>
        </Link>

        <Link to="/essay" className="home-card home-card--essay">
          <div className="home-card-header">
            <h3 className="home-card-title">{t.essayTitle}</h3>
            <span className="home-card-arrow">→</span>
          </div>
          <div className="home-card-cta">{t.essayCta}</div>
          <div className="home-card-detail">
            {t.essayDetailPre}
            <span className="home-card-detail-strong">A1–B2</span>
            {t.essayDetailMid}
          </div>
        </Link>

        <Link to="/stats" className="home-card home-card--stats">
          <div className="home-card-header">
            <h3 className="home-card-title">{t.statsTitle}</h3>
            <span className="home-card-arrow">→</span>
          </div>
          <div className="home-card-cta">{t.statsCta}</div>
          <div className="home-card-detail">
            {lastQuiz || lastEssay ? (
              <>
                {lastQuiz && (
                  <>
                    {t.statsLastQuiz}{" "}
                    <span className="home-card-detail-strong">
                      {lastQuiz.correct}/{lastQuiz.total} ({Math.round((lastQuiz.correct / lastQuiz.total) * 100)}%)
                    </span>
                    {lastEssay ? " · " : ""}
                  </>
                )}
                {lastEssay && (
                  <>
                    {t.statsLastEssay}{" "}
                    <span className="home-card-detail-strong">
                      {lastEssay.achievedLevel}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="home-card-empty">{t.statsEmpty}</span>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
