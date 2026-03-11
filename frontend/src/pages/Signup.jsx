import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "../api/auth";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await signup({
        email,
        password,
        firstName,
        lastName,
        phoneNumber: phoneNumber.trim() || undefined,
      });
      navigate("/login", { state: { message: "Account created. Please sign in." } });
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      maxWidth: "100%",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      fontFamily: "'DM Sans', sans-serif",
      padding: "1rem",
      boxSizing: "border-box",
      overflowY: "auto",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Playfair+Display:wght@700&display=swap');
        .signup-input {
          width: 100%; padding: 0.5rem 0.75rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(99,102,241,0.25);
          border-radius: 8px; color: #e2e8f0;
          font-size: 0.9rem; font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
          transition: border-color 0.2s, background 0.2s;
          outline: none;
        }
        .signup-input::placeholder { color: #475569; }
        .signup-input:focus {
          border-color: rgba(99,102,241,0.6);
          background: rgba(99,102,241,0.07);
        }
        .signup-btn {
          width: 100%; padding: 0.55rem;
          background: rgba(99,102,241,0.8);
          border: 1px solid rgba(99,102,241,0.5);
          border-radius: 8px; color: #e2e8f0;
          font-size: 0.9rem; font-family: 'DM Sans', sans-serif;
          font-weight: 500; letter-spacing: 0.04em;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .signup-btn:hover:not(:disabled) {
          background: rgba(99,102,241,1);
          border-color: rgba(129,140,248,0.7);
        }
        .signup-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .signin-link { color: #818cf8; text-decoration: none; font-size: 0.85rem; transition: color 0.2s; }
        .signin-link:hover { color: #c7d2fe; }
      `}</style>

      <div style={{
        width: "100%",
        maxWidth: "400px",
        flexShrink: 0,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "18px",
        padding: "1.25rem 1.5rem",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        boxSizing: "border-box",
      }}>
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.35rem",
            fontWeight: 700,
            color: "#e2e8f0",
            marginBottom: "0.2rem",
          }}>
            Create Your Account
          </div>
          <div style={{ color: "#64748b", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
            Sign up to get started
          </div>
        </div>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "8px", color: "#fca5a5",
            padding: "0.5rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.8rem",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                FIRST NAME
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="signup-input"
                placeholder="Jane"
                required
              />
            </div>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                LAST NAME
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="signup-input"
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "0.6rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="signup-input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div style={{ marginBottom: "0.6rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
              PHONE <span style={{ color: "#64748b", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="signup-input"
              placeholder="(555) 123-4567"
            />
          </div>

          <div style={{ marginBottom: "0.6rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="signup-input"
              placeholder="••••••••"
              required
              minLength={8}
              title="8+ chars, upper, lower, number, special"
            />
            <div style={{ color: "#64748b", fontSize: "0.68rem", marginTop: "0.25rem", marginBottom: "0.5rem", lineHeight: 1.3 }}>
              8+ chars, upper, lower, number, special
            </div>
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="signup-input"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "0.9rem" }}>
          <Link to="/login" className="signin-link">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;
