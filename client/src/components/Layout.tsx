import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useLang } from "../lib/lang";
import logoUrl from "../assets/logo-brain-bubble.svg";
import "./Layout.css";

const LABELS = {
  en: {
    home: "Home",
    learningSession: "Learning Session",
    review: "Review",
    quiz: "Quiz!",
    essay: "Short Essay",
    stats: "Scores",
    wordList: "My Word List",
  },
  no: {
    home: "Hjem",
    learningSession: "Læringsøkt",
    review: "Gjennomgang",
    quiz: "Quiz!",
    essay: "Kort essay",
    stats: "Resultater",
    wordList: "Min ordliste",
  },
};

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { lang, setLang } = useLang();
  const closeMenu = () => setMenuOpen(false);
  const t = LABELS[lang];

  return (
    <div className="app-layout">
      <nav className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar-header">
          <Link to="/" className="logo-link" onClick={closeMenu}>
            <h1 className="logo">ComCoach</h1>
            <img src={logoUrl} alt="" className="logo-mark" aria-hidden="true" />
          </Link>
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? "×" : "☰"}
          </button>
        </div>
        <ul onClick={closeMenu}>
          <li><NavLink to="/">{t.home}</NavLink></li>
          <li><NavLink to="/learning-session">{t.learningSession}</NavLink></li>
          <li><NavLink to="/review">{t.review}</NavLink></li>
          <li><NavLink to="/quiz">{t.quiz}</NavLink></li>
          <li><NavLink to="/essay">{t.essay}</NavLink></li>
          <li><NavLink to="/stats">{t.stats}</NavLink></li>
          <li><NavLink to="/word-list">{t.wordList}</NavLink></li>
        </ul>
        <div className="sidebar-footer">
          <div className="lang-toggle" role="group" aria-label="Language">
            <button
              className={`lang-toggle-option ${lang === "no" ? "lang-toggle-option--active" : ""}`}
              onClick={() => setLang("no")}
              aria-pressed={lang === "no"}
            >
              NO
            </button>
            <span className="lang-toggle-divider">|</span>
            <button
              className={`lang-toggle-option ${lang === "en" ? "lang-toggle-option--active" : ""}`}
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
            >
              EN
            </button>
          </div>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
