import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { login } from "../api/auth";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.state?.message, location.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxHeight: "100vh",
      width: "100%", maxWidth: "400px",
      background: "#0d1424",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      padding: "1rem",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Playfair+Display:wght@700&display=swap');
        .login-input {
          width: 100%; padding: 0.65rem 0.9rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 8px; color: #e2e8f0;
          font-size: 0.9rem; font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
          transition: border-color 0.2s, background 0.2s;
          outline: none;
        }
        .login-input::placeholder { color: #475569; }
        .login-input:focus {
          border-color: rgba(99,102,241,0.6);
          background: rgba(99,102,241,0.07);
        }
        .login-btn {
          width: 100%; padding: 0.7rem;
          background: rgba(99,102,241,0.8);
          border: 1px solid rgba(99,102,241,0.5);
          border-radius: 8px; color: #e2e8f0;
          font-size: 0.9rem; font-family: 'DM Sans', sans-serif;
          font-weight: 500; letter-spacing: 0.04em;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .login-btn:hover:not(:disabled) {
          background: rgba(99,102,241,1);
          border-color: rgba(129,140,248,0.7);
        }
        .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .new-user-link { color: #818cf8; text-decoration: none; font-size: 0.85rem; transition: color 0.2s; }
        .new-user-link:hover { color: #c7d2fe; }
      `}</style>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: "400px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "18px",
        padding: "2.5rem 2rem",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.5rem", fontWeight: 700,
            color: "#e2e8f0", marginBottom: "0.35rem",
          }}>
            Financial Capstone
          </div>
          <div style={{ color: "#64748b", fontSize: "0.82rem", letterSpacing: "0.05em" }}>
            SIGN IN TO YOUR ACCOUNT
          </div>
        </div>

        {/* Success (e.g. after signup) */}
        {successMessage && (
          <div style={{
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: "8px", color: "#86efac",
            padding: "0.6rem 0.9rem", marginBottom: "1.2rem", fontSize: "0.85rem",
          }}>
            {successMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "8px", color: "#fca5a5",
            padding: "0.6rem 0.9rem", marginBottom: "1.2rem", fontSize: "0.85rem",
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.1rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.78rem", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div style={{ marginBottom: "1.6rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.78rem", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* New user link */}
        <div style={{ textAlign: "center", marginTop: "1.4rem" }}>
          <Link to="/signup" className="new-user-link">New user? Create account</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;