/**
 * Status indicator dot component
 * Shows green (healthy), yellow (loading), or red (error)
 */

function StatusDot({ status, error }) {
  const isHealthy = status && status.ok;
  const color = isHealthy ? "#22c55e" : error ? "#ef4444" : "#eab308";
  const shadowColor = isHealthy
    ? "rgba(34,197,94,0.35)"
    : error
    ? "rgba(239,68,68,0.35)"
    : "rgba(234,179,8,0.35)";

  return (
    <span
      style={{
        display: "inline-flex",
        width: "0.6rem",
        height: "0.6rem",
        borderRadius: "999px",
        background: color,
        boxShadow: `0 0 0 4px ${shadowColor}`
      }}
    />
  );
}

export default StatusDot;
