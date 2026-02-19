import { useEffect, useState } from "react";

function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a, #020617)",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <section
        style={{
          maxWidth: 640,
          width: "100%",
          padding: "2.5rem",
          borderRadius: "1.5rem",
          background: "rgba(15,23,42,0.9)",
          boxShadow:
            "0 20px 25px -5px rgba(15,23,42,0.8), 0 10px 10px -5px rgba(15,23,42,0.8)",
          border: "1px solid rgba(148,163,184,0.3)"
        }}
      >
        <h1
          style={{
            fontSize: "1.875rem",
            fontWeight: 700,
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          Capstone App
          <span
            style={{
              display: "inline-flex",
              width: "0.6rem",
              height: "0.6rem",
              borderRadius: "999px",
              background:
                health && health.ok ? "#22c55e" : error ? "#ef4444" : "#eab308",
              boxShadow:
                health && health.ok
                  ? "0 0 0 4px rgba(34,197,94,0.35)"
                  : error
                  ? "0 0 0 4px rgba(239,68,68,0.35)"
                  : "0 0 0 4px rgba(234,179,8,0.35)"
            }}
          />
        </h1>

        <p style={{ marginBottom: "0.75rem", color: "#cbd5f5" }}>
          Flask + React + Azure SQL starter is running.
        </p>

        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem 1.25rem",
            borderRadius: "0.75rem",
            background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(55,65,81,0.8)",
            fontSize: "0.9rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
          }}
        >
          <div style={{ marginBottom: "0.5rem", fontWeight: 600 }}>
            Health endpoint
          </div>
          {error && (
            <div style={{ color: "#fecaca" }}>
              Error fetching `/api/health`: {error}
            </div>
          )}
          {!error && !health && (
            <div style={{ color: "#e5e7eb" }}>Checking backend health...</div>
          )}
          {health && (
            <pre
              style={{
                marginTop: "0.5rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all"
              }}
            >
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;

