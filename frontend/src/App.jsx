import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Other from "./pages/other";
import Navbar from "./components/Navbar";

/**
 * Main App component
 * Handles routing and layout
 */
function App() {
  return (
    <Router>
      <Navbar />
      <main
        style={{
          paddingTop: "4rem", // ensure content sits below fixed nav
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1424",
          color: "#e5e7eb",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/other" element={<Other />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
