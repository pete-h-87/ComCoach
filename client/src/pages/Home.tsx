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
    chartLegendQuizzes: "Quizzes",
    chartLegendEssays: "Essays",
    chartProgress: "Progress over your last 10 attempts.",
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
    chartLegendQuizzes: "Quizer",
    chartLegendEssays: "Essayer",
    chartProgress: "Fremgang over dine siste 10 forsøk.",
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

const LEVEL_TO_PCT: Record<string, number> = { A1: 25, A2: 50, B1: 75, B2: 100 };

function ProgressChart({
  quizzes,
  essays,
}: {
  quizzes: QuizAttempt[];
  essays: EssayAttempt[];
}) {
  const RECENT = 10;
  // Most recent first → reverse so chart reads left-to-right oldest → newest.
  const quizSeries = quizzes
    .slice(0, RECENT)
    .reverse()
    .map((q) => Math.round((q.correct / q.total) * 100));
  const essaySeries = essays
    .slice(0, RECENT)
    .reverse()
    .map((e) => LEVEL_TO_PCT[e.achievedLevel] ?? 0);

  if (quizSeries.length === 0 && essaySeries.length === 0) return null;

  const W = 200;
  const H = 100;
  const PT = 6;
  const PR = 6;
  const PB = 14;
  const PL = 14;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const xFor = (i: number, len: number) =>
    len > 1 ? PL + (i * innerW) / (len - 1) : PL + innerW / 2;
  const yFor = (v: number) => PT + innerH - (v / 100) * innerH;

  const polyline = (series: number[]) =>
    series.map((v, i) => `${xFor(i, series.length)},${yFor(v)}`).join(" ");

  const dots = (series: number[], color: string) =>
    series.map((v, i) => (
      <circle
        key={i}
        cx={xFor(i, series.length)}
        cy={yFor(v)}
        r="1.6"
        fill={color}
      />
    ));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="home-stats-chart" preserveAspectRatio="none">
      {/* Y gridlines + labels at 25/50/75/100 */}
      {[0, 25, 50, 75, 100].map((p) => {
        const y = yFor(p);
        return (
          <g key={p}>
            <line
              x1={PL}
              y1={y}
              x2={W - PR}
              y2={y}
              stroke="#cfd6df"
              strokeWidth="0.3"
            />
            <text x={PL - 2} y={y + 1.5} fontSize="3.5" textAnchor="end" fill="#6b7a8e">
              {p}
            </text>
          </g>
        );
      })}

      {quizSeries.length > 0 && (
        <>
          <polyline
            fill="none"
            stroke="#2a6fdb"
            strokeWidth="0.9"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyline(quizSeries)}
          />
          {dots(quizSeries, "#2a6fdb")}
        </>
      )}
      {essaySeries.length > 0 && (
        <>
          <polyline
            fill="none"
            stroke="#06a77d"
            strokeWidth="0.9"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyline(essaySeries)}
          />
          {dots(essaySeries, "#06a77d")}
        </>
      )}
    </svg>
  );
}

export default function Home() {
  const { lang } = useLang();
  const t = TEXT[lang];
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [words, setWords] = useState<WordSummary[] | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [essayAttempts, setEssayAttempts] = useState<EssayAttempt[]>([]);

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
      .then((data) => setQuizAttempts(data.attempts ?? []))
      .catch(() => {});

    fetch("/api/essay/attempts")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setEssayAttempts(data.attempts ?? []))
      .catch(() => {});
  }, []);

  const lastQuiz = quizAttempts[0] ?? null;
  const lastEssay = essayAttempts[0] ?? null;

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

          {quizAttempts.length === 0 && essayAttempts.length === 0 ? (
            <div className="home-stats-chart-empty">
              <span className="home-card-empty">{t.statsEmpty}</span>
            </div>
          ) : (
            <>
              <ProgressChart quizzes={quizAttempts} essays={essayAttempts} />
              <div className="home-stats-legend">
                <span className="home-stats-legend-item">
                  <span className="home-stats-legend-swatch home-stats-legend-swatch--quiz" />
                  {t.chartLegendQuizzes}
                </span>
                <span className="home-stats-legend-item">
                  <span className="home-stats-legend-swatch home-stats-legend-swatch--essay" />
                  {t.chartLegendEssays}
                </span>
              </div>
            </>
          )}

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
            ) : null}
          </div>
        </Link>
      </div>
    </div>
  );
}
