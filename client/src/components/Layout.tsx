import { NavLink, Outlet } from "react-router-dom";
import "./Layout.css";

export default function Layout() {
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <h1 className="logo">ComCoach</h1>
        <ul>
          <li><NavLink to="/">Home</NavLink></li>
          <li><NavLink to="/learning-session">Learning Session</NavLink></li>
          <li><NavLink to="/practice">Practice</NavLink></li>
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
