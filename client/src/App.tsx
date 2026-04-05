import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import LearningSession from "./pages/LearningSession";
import Practice from "./pages/Practice";
import Quiz from "./pages/Quiz";
import WordList from "./pages/WordList";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/learning-session" element={<LearningSession />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/word-list" element={<WordList />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
