/**
 * Health endpoint display card component
 */

function HealthCard({ health, error }) {
  return (
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
  );
}

export default HealthCard;
