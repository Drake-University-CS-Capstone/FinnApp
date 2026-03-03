import { useState, useEffect } from "react";

const STATUS = { idle: "idle", loading: "loading", ok: "ok", error: "error" };

export default function DatabasePage() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState(STATUS.idle);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchUsers = async () => {
    setStatus(STATUS.loading);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setUsers(data);
      setStatus(STATUS.ok);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
      setStatus(STATUS.error);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div style={styles.root}>
      {/* Subtle grid background */}
      <div style={styles.gridBg} />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.pill}>Azure SQL</div>
            <h1 style={styles.title}>Database<br /><em style={styles.titleAccent}>Viewer</em></h1>
          </div>
          <div style={styles.headerRight}>
            <button onClick={fetchUsers} style={styles.refreshBtn} disabled={status === STATUS.loading}>
              <span style={{
                display: "inline-block",
                animation: status === STATUS.loading ? "spin 1s linear infinite" : "none",
              }}>↻</span>
              {status === STATUS.loading ? " Fetching…" : " Refresh"}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <span style={styles.statNum}>{users.length}</span>
            <span style={styles.statLabel}>Records</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.stat}>
            <span style={{
              ...styles.statusDot,
              background: status === STATUS.ok ? "#22c55e"
                : status === STATUS.error ? "#ef4444"
                : status === STATUS.loading ? "#f59e0b"
                : "#6b7280",
            }} />
            <span style={styles.statLabel}>
              {status === STATUS.ok ? "Connected"
                : status === STATUS.error ? "Error"
                : status === STATUS.loading ? "Loading"
                : "Idle"}
            </span>
          </div>
          {lastFetched && (
            <>
              <div style={styles.statDivider} />
              <div style={styles.stat}>
                <span style={styles.statLabel}>Last fetched {lastFetched.toLocaleTimeString()}</span>
              </div>
            </>
          )}
        </div>

        {/* Error state */}
        {status === STATUS.error && (
          <div style={styles.errorBox}>
            <strong>⚠ Connection failed</strong>
            <p style={{ margin: "6px 0 0", fontSize: "13px", opacity: 0.85 }}>{error}</p>
            <p style={{ margin: "8px 0 0", fontSize: "12px", opacity: 0.65 }}>
              Check your DATABASE_URL in <code>backend/.env</code> and that your Azure SQL firewall allows your IP.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {status === STATUS.loading && users.length === 0 && (
          <div style={styles.tableWrap}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ ...styles.skeletonRow, opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        )}

        {/* Table */}
        {users.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["ID", "Email", "Created At"].map(col => (
                    <th key={col} style={styles.th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    style={{
                      ...styles.tr,
                      animationDelay: `${i * 40}ms`,
                      animation: "fadeSlide 0.35s ease both",
                    }}
                  >
                    <td style={{ ...styles.td, ...styles.tdId }}>{u.id}</td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={{ ...styles.td, ...styles.tdMuted }}>{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {status === STATUS.ok && users.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>⬡</div>
            <p style={styles.emptyText}>No records found in the <code>users</code> table.</p>
            <p style={styles.emptySubText}>Run <code>flask db upgrade</code> and insert some rows to get started.</p>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: #0a0a0f; }
        tr:hover td { background: rgba(99,102,241,0.07) !important; }
        code { font-family: 'DM Mono', monospace; background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }
      `}</style>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0f",
    fontFamily: "'Syne', sans-serif",
    color: "#e8e8f0",
    position: "relative",
    overflow: "hidden",
  },
  gridBg: {
    position: "fixed",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)
    `,
    backgroundSize: "48px 48px",
    pointerEvents: "none",
  },
  container: {
    maxWidth: 880,
    margin: "0 auto",
    padding: "60px 24px 80px",
    position: "relative",
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 32,
    flexWrap: "wrap",
    gap: 16,
  },
  headerLeft: { display: "flex", flexDirection: "column", gap: 12 },
  headerRight: {},
  pill: {
    display: "inline-block",
    background: "rgba(99,102,241,0.15)",
    border: "1px solid rgba(99,102,241,0.35)",
    color: "#a5b4fc",
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    fontWeight: 500,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    padding: "4px 12px",
    borderRadius: 100,
    width: "fit-content",
  },
  title: {
    margin: 0,
    fontSize: "clamp(36px, 6vw, 56px)",
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
  },
  titleAccent: {
    fontStyle: "italic",
    fontWeight: 400,
    color: "#818cf8",
  },
  refreshBtn: {
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.3)",
    color: "#a5b4fc",
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    padding: "10px 20px",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
    letterSpacing: "0.02em",
  },
  statsBar: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "14px 20px",
    marginBottom: 24,
    flexWrap: "wrap",
  },
  stat: { display: "flex", alignItems: "center", gap: 8 },
  statNum: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 22,
    fontWeight: 500,
    color: "#e8e8f0",
  },
  statLabel: { fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono', monospace" },
  statDivider: { width: 1, height: 20, background: "rgba(255,255,255,0.08)" },
  statusDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  errorBox: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 24,
    color: "#fca5a5",
  },
  tableWrap: {
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    overflow: "hidden",
    background: "rgba(255,255,255,0.02)",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "14px 20px",
    fontSize: 10,
    fontFamily: "'DM Mono', monospace",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#4b5563",
    background: "rgba(0,0,0,0.3)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  tr: {},
  td: {
    padding: "14px 20px",
    fontSize: 14,
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    transition: "background 0.15s",
  },
  tdId: {
    fontFamily: "'DM Mono', monospace",
    color: "#6366f1",
    fontWeight: 500,
    width: 60,
  },
  tdMuted: { color: "#6b7280", fontFamily: "'DM Mono', monospace", fontSize: 12 },
  skeletonRow: {
    height: 48,
    background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    margin: "1px 0",
  },
  empty: {
    textAlign: "center",
    padding: "64px 24px",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
  },
  emptyIcon: { fontSize: 40, marginBottom: 16, opacity: 0.3 },
  emptyText: { margin: 0, color: "#9ca3af", fontSize: 15 },
  emptySubText: { margin: "8px 0 0", color: "#4b5563", fontSize: 13 },
};