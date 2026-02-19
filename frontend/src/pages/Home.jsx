import { useEffect, useState } from "react";
import { getHealth } from "../api/health";
import StatusDot from "../components/StatusDot";
import HealthCard from "../components/HealthCard";

/**
 * Home page component
 */
function Home() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getHealth()
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
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
          gap: "0.5rem",
          color: "red"
        }}
      >
        Capstone App
        <StatusDot status={health} error={error} />
      </h1>

      <p style={{ marginBottom: "0.75rem", color: "#cbd5f5" }}>
        Flask + React + Azure SQL starter is running.
      </p>

      <HealthCard health={health} error={error} />
    </section>
  );
}

export default Home;
