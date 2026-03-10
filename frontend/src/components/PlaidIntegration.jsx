import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

const styles = {
  card: {
    marginTop: "1.5rem",
    padding: "1rem 1.25rem",
    borderRadius: "0.75rem",
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(55,65,81,0.8)",
    fontSize: "0.9rem",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
    color: "#e5e7eb",
  },
  label: {
    marginBottom: "0.5rem",
    fontWeight: 600,
    color: "#e5e7eb",
  },
  muted: {
    color: "#e5e7eb",
  },
  success: {
    color: "#86efac",
  },
  error: {
    color: "#fecaca",
  },
  button: {
    marginTop: "0.75rem",
    padding: "0.5rem 1.25rem",
    borderRadius: "0.5rem",
    border: "1px solid rgba(55,65,81,0.8)",
    background: "rgba(30,41,59,0.9)",
    color: "#e5e7eb",
    fontSize: "0.875rem",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 80px",
    gap: "0.5rem",
    padding: "0.5rem 0.75rem",
    marginTop: "1rem",
    borderBottom: "1px solid rgba(55,65,81,0.8)",
    color: "#94a3b8",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  txRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 80px",
    gap: "0.5rem",
    padding: "0.6rem 0.75rem",
    borderBottom: "1px solid rgba(55,65,81,0.3)",
    alignItems: "center",
  },
  txName: {
    color: "#e5e7eb",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  txCategory: {
    color: "#94a3b8",
    fontSize: "0.8rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  txDate: {
    color: "#94a3b8",
    fontSize: "0.8rem",
  },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAmount(amount) {
  const abs = Math.abs(amount).toFixed(2);
  const isIncome = amount < 0;
  return (
    <span style={{ color: isIncome ? '#86efac' : '#e5e7eb', textAlign: 'right', display: 'block' }}>
      {isIncome ? '+' : '-'}${abs}
    </span>
  );
}

function TransactionList({ transactions }) {
  const txList = transactions?.transactions || [];

  if (txList.length === 0) {
    return <div style={{ ...styles.muted, marginTop: '0.75rem' }}>No transactions found.</div>;
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={styles.tableHeader}>
        <span>Name</span>
        <span>Date</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
      </div>
      {txList.map((tx) => (
        <div key={tx.transaction_id} style={styles.txRow}>
          <span style={styles.txName}>{tx.merchant_name || tx.name || '—'}</span>
          <span style={styles.txDate}>{formatDate(tx.date)}</span>
          {formatAmount(tx.amount)}
        </div>
      ))}
    </div>
  );
}

export default function PlaidIntegration() {
  const [linkToken, setLinkToken] = useState(null);
  const [isLinked, setIsLinked] = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await fetch('/api/plaid/create_link_token', { method: 'POST' });
        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (err) {
        console.error('Error fetching link token:', err);
        setError('Could not fetch link token.');
      }
    };
    fetchLinkToken();
  }, []);

  const onSuccess = useCallback(async (public_token) => {
    try {
      const response = await fetch('/api/plaid/set_access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      if (response.ok) {
        setIsLinked(true);
      } else {
        const errData = await response.json();
        setError(errData.error?.display_message || 'Failed to set access token');
      }
    } catch (err) {
      console.error('Error exchanging token:', err);
      setError('Token exchange failed.');
    }
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/plaid/transactions');
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to fetch transactions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.label}>Plaid integration</div>

      {error && (
        <div style={styles.error}>Error: {error}</div>
      )}

      {!isLinked ? (
        <div>
          <div style={styles.muted}>Status: not linked</div>
          <button
            onClick={() => open()}
            disabled={!ready || !linkToken}
            style={{ ...styles.button, ...(!ready || !linkToken ? styles.buttonDisabled : {}) }}
          >
            Link bank account
          </button>
        </div>
      ) : (
        <div>
          <div style={styles.success}>Status: linked successfully</div>
          <button
            onClick={fetchTransactions}
            disabled={loading}
            style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
          >
            {loading ? 'Fetching...' : 'Get transactions'}
          </button>

          {transactions && <TransactionList transactions={transactions} />}
        </div>
      )}
    </div>
  );
}