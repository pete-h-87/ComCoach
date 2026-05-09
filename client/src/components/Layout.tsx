import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import "./Layout.css";

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app-layout">
      <nav className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar-header">
          <h1 className="logo">ComCoach</h1>
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
          <li><NavLink to="/">Home</NavLink></li>
          <li><NavLink to="/learning-session">Learning Session</NavLink></li>
          <li><NavLink to="/review">Review</NavLink></li>
          <li><NavLink to="/quiz">Quiz!</NavLink></li>
          <li><NavLink to="/word-list">My Word List</NavLink></li>
        </ul>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
