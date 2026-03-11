import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Other from "./pages/other";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * Main App component
 * First page is login. Login and signup are public; all other routes are protected.
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
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/other" element={<ProtectedRoute><Other /></ProtectedRoute>} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
