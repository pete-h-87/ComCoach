import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import LearningSession from "./pages/LearningSession";
import Review from "./pages/Review";
import Quiz from "./pages/Quiz";
import Essay from "./pages/Essay";
import Stats from "./pages/Stats";
import WordList from "./pages/WordList";
import { LangProvider } from "./lib/lang";

function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/learning-session" element={<LearningSession />} />
            <Route path="/review" element={<Review />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/essay" element={<Essay />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/word-list" element={<WordList />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}

export default App;
