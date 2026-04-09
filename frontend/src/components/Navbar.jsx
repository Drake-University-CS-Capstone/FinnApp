import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem("token")));

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "token") setHasToken(Boolean(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const pages = [
    { label: "Home", to: "/home" },
    { label: "Stock Market", to: "/stock-market" },
    { label: "Reports", to: "/reports" },
    /*{ label: "Settings", to: "/settings" },*/
    { label: "Other", to: "/other"}
  ];

  return (
    <nav style={{
      position: "fixed", top: 0, width: "100%", zIndex: 50,
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      borderBottom: "1px solid rgba(99,102,241,0.25)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Playfair+Display:wght@700&display=swap');
        .nav-link { color: #94a3b8; text-decoration: none; font-size: 0.85rem; letter-spacing: 0.04em; transition: color 0.2s; }
        .nav-link:hover { color: #e2e8f0; }
        .dropdown-item { display: block; padding: 0.5rem 1.1rem; color: #94a3b8; text-decoration: none; font-size: 0.85rem; letter-spacing: 0.03em; border-radius: 6px; transition: background 0.15s, color 0.15s; }
        .dropdown-item:hover { background: rgba(99,102,241,0.15); color: #e2e8f0; }
        .login-btn { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.4); color: #a5b4fc; text-decoration: none; padding: 0.35rem 1rem; border-radius: 8px; font-size: 0.82rem; letter-spacing: 0.05em; transition: background 0.2s, border-color 0.2s, color 0.2s; }
        .login-btn:hover { background: rgba(99,102,241,0.3); border-color: rgba(99,102,241,0.7); color: #c7d2fe; }
        .menu-btn { background: none; border: 1px solid rgba(99,102,241,0.3); color: #94a3b8; padding: 0.3rem 0.55rem; border-radius: 7px; cursor: pointer; font-size: 1rem; transition: border-color 0.2s, color 0.2s; display: flex; align-items: center; gap: 0.35rem; }
        .menu-btn:hover { border-color: rgba(99,102,241,0.6); color: #e2e8f0; }
        .dropdown-panel { position: absolute; top: calc(100% + 6px); left: 0; background: #0f172a; border: 1px solid rgba(99,102,241,0.2); border-radius: 10px; padding: 0.4rem; min-width: 160px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); animation: fadeIn 0.15s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", height: "58px" }}>

          {/* Left — dropdown */}
          <div ref={dropdownRef} style={{ position: "relative", justifySelf: "start" }}>
            <button className="menu-btn" onClick={() => setIsOpen(o => !o)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <span style={{ fontSize: "0.78rem", letterSpacing: "0.04em" }}>Menu</span>
            </button>
            {isOpen && (
              <div className="dropdown-panel">
                {pages.map(p => (
                  <Link key={p.to} to={p.to} className="dropdown-item" onClick={() => setIsOpen(false)}>
                    {p.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Center — app name */}
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: "1.15rem",
            color: "#e2e8f0",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}>
            Financial Capstone
          </div>

          {/* Right — login */}
          <div style={{ justifySelf: "end" }}>
            {hasToken ? (
              <button
                type="button"
                className="login-btn"
                onClick={async () => {
                  await logout();
                  setHasToken(false);
                  navigate("/login", { replace: true });
                }}
              >
                Sign out
              </button>
            ) : (
              <Link to="/login" className="login-btn">Login</Link>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}