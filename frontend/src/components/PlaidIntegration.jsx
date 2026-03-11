import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

// ── Fonts (matches navbar) ────────────────────────────────────────────────────
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@700&display=swap';

// ── Tokens (pulled straight from navbar palette) ─────────────────────────────
const T = {
  bg:         '#0d1424',
  surface:    'rgba(255,255,255,0.03)',
  surfaceHov: 'rgba(99,102,241,0.08)',
  border:     'rgba(99,102,241,0.2)',
  borderHov:  'rgba(99,102,241,0.4)',
  text:       '#e2e8f0',
  muted:      '#94a3b8',
  accent:     '#a5b4fc',
  accentBg:   'rgba(99,102,241,0.15)',
  accentBord: 'rgba(99,102,241,0.4)',
  green:      '#86efac',
  greenBg:    'rgba(134,239,172,0.1)',
  red:        '#fca5a5',
  redBg:      'rgba(252,165,165,0.1)',
  sans:       "'DM Sans', system-ui, sans-serif",
  display:    "'Playfair Display', Georgia, serif",
};

// ── Category config ───────────────────────────────────────────────────────────
const CAT = {
  FOOD_AND_DRINK: { icon: '🍔', label: 'Food & Drink' },
  TRANSPORTATION: { icon: '🚗', label: 'Transport' },
  SHOPPING:       { icon: '🛍️', label: 'Shopping' },
  ENTERTAINMENT:  { icon: '🎬', label: 'Entertainment' },
  INCOME:         { icon: '💰', label: 'Income' },
  TRANSFER_IN:    { icon: '↙️', label: 'Transfer In' },
  TRANSFER_OUT:   { icon: '↗️', label: 'Transfer Out' },
  TRAVEL:         { icon: '✈️', label: 'Travel' },
  HEALTH:         { icon: '❤️', label: 'Health' },
  LOAN_PAYMENTS:  { icon: '🏦', label: 'Loan Payment' },
  OTHER:          { icon: '📋', label: 'Other' },
};
const getCat = k => CAT[k] || CAT.OTHER;

const fmtUSD = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n ?? 0));

const fmtDate = s => {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Left panel: balances + spending summary ───────────────────────────────────
function LeftPanel({ accounts, transactions }) {
  const txList = transactions?.transactions || [];
  const totalSpent  = txList.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalIncome = txList.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  // Spending by category
  const byCat = {};
  txList.filter(t => t.amount > 0).forEach(t => {
    const k = t.category || 'OTHER';
    byCat[k] = (byCat[k] || 0) + t.amount;
  });
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>

      {/* Account balance cards */}
      {accounts?.map(acct => {
        const isCredit = acct.type?.includes('credit');
        return (
          <div key={acct.account_id} style={{
            padding: '1.25rem 1.4rem',
            borderRadius: '12px',
            background: T.surface,
            border: `1px solid ${T.border}`,
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.borderHov}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              {acct.name}
              {acct.official_name && acct.official_name !== acct.name && (
                <span style={{ fontWeight: 400, marginLeft: 6 }}>· {acct.official_name}</span>
              )}
            </div>
            <div style={{ fontFamily: T.display, fontSize: '2rem', color: T.text, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              {fmtUSD(acct.balances?.current)}
            </div>
            {acct.balances?.available != null && (
              <div style={{ fontSize: '0.78rem', color: T.muted, marginTop: '0.3rem' }}>
                {fmtUSD(acct.balances.available)} available
              </div>
            )}
            <div style={{
              marginTop: '0.75rem',
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.05em',
              color: isCredit ? T.red : T.green,
              background: isCredit ? T.redBg : T.greenBg,
              padding: '0.2rem 0.6rem', borderRadius: '99px',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isCredit ? T.red : T.green, display: 'inline-block' }} />
              {acct.subtype || acct.type}
            </div>
          </div>
        );
      })}

      {/* Cash flow summary */}
      <div style={{
        padding: '1.25rem 1.4rem', borderRadius: '12px',
        background: T.surface, border: `1px solid ${T.border}`,
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '1rem' }}>
          Cash flow
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: T.muted }}>Income</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: T.green }}>{fmtUSD(totalIncome)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: T.muted }}>Spent</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: T.text }}>{fmtUSD(totalSpent)}</span>
          </div>
          <div style={{ height: '1px', background: T.border, margin: '0.25rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: T.text }}>Net</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: T.display, color: totalIncome - totalSpent >= 0 ? T.green : T.red }}>
              {totalIncome - totalSpent >= 0 ? '+' : '-'}{fmtUSD(totalIncome - totalSpent)}
            </span>
          </div>
        </div>
      </div>

      {/* Top spending categories */}
      {topCats.length > 0 && (
        <div style={{
          padding: '1.25rem 1.4rem', borderRadius: '12px',
          background: T.surface, border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Top spending
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {topCats.map(([key, amt]) => {
              const cat = getCat(key);
              const pct = totalSpent ? (amt / totalSpent) * 100 : 0;
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem', color: T.muted }}>{cat.icon} {cat.label}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: T.text }}>{fmtUSD(amt)}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(99,102,241,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: 'linear-gradient(90deg, rgba(99,102,241,0.6), rgba(165,180,252,0.8))',
                      borderRadius: 99,
                      transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Right panel: transaction list ─────────────────────────────────────────────
function RightPanel({ transactions }) {
  const txList = transactions?.transactions || [];
  const [filter, setFilter] = useState('ALL');

  const categories = ['ALL', ...new Set(txList.map(t => t.category).filter(Boolean))];
  const filtered = filter === 'ALL' ? txList : txList.filter(t => t.category === filter);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: '12px', overflow: 'hidden', height: '100%',
    }}>
      {/* Panel header */}
      <div style={{ padding: '1.25rem 1.4rem', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: T.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Transactions · {txList.length} total
        </div>
        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {categories.map(cat => {
            const active = filter === cat;
            return (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                padding: '0.2rem 0.7rem', borderRadius: '99px',
                fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.03em',
                border: `1px solid ${active ? T.accentBord : 'rgba(99,102,241,0.15)'}`,
                background: active ? T.accentBg : 'transparent',
                color: active ? T.accent : T.muted,
                cursor: 'pointer', fontFamily: T.sans,
                transition: 'all 0.15s',
              }}>
                {cat === 'ALL' ? 'All' : getCat(cat).label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '28px 1fr 100px 88px',
        gap: '0.6rem', padding: '0.5rem 1.4rem',
        borderBottom: `1px solid rgba(99,102,241,0.1)`,
      }}>
        {['', 'Name', 'Date', 'Amount'].map((h, i) => (
          <div key={i} style={{
            fontSize: '0.65rem', fontWeight: 600, color: T.muted,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            textAlign: i > 1 ? 'right' : 'left',
          }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0
          ? <div style={{ padding: '2rem 1.4rem', color: T.muted, fontSize: '0.82rem' }}>No transactions in this category.</div>
          : filtered.map(tx => {
              const cat = getCat(tx.category);
              const isIncome = tx.amount < 0;
              return (
                <div key={tx.transaction_id} style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr 100px 88px',
                  alignItems: 'center', gap: '0.6rem',
                  padding: '0.65rem 1.4rem',
                  borderBottom: `1px solid rgba(99,102,241,0.07)`,
                  transition: 'background 0.12s',
                  cursor: 'default',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '15px' }}>{cat.icon}</span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 500, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.name || '—'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 1 }}>{cat.label}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: T.muted, textAlign: 'right' }}>{fmtDate(tx.date)}</div>
                  <div style={{ fontSize: '0.83rem', fontWeight: 600, textAlign: 'right', color: isIncome ? T.green : T.text }}>
                    {isIncome ? '+' : '-'}{fmtUSD(tx.amount)}
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── Dashboard (linked state) ──────────────────────────────────────────────────
function Dashboard({ onDisconnect }) {
  const [transactions, setTransactions] = useState(null);
  const [accounts,     setAccounts]     = useState(null);
  const [loadingTx,    setLoadingTx]    = useState(true);
  const [loadingBal,   setLoadingBal]   = useState(true);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    fetch('/api/plaid/transactions')
      .then(r => r.json()).then(setTransactions)
      .catch(() => setError('Failed to load transactions.'))
      .finally(() => setLoadingTx(false));

    fetch('/api/plaid/balance')
      .then(r => r.json()).then(d => setAccounts(d.accounts))
      .catch(() => setError('Failed to load balances.'))
      .finally(() => setLoadingBal(false));
  }, []);

  const loading = loadingTx || loadingBal;

  return (
    <div style={{ fontFamily: T.sans, color: T.text }}>
      <link rel="stylesheet" href={FONT_LINK} />

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontFamily: T.display, fontSize: '1.6rem', color: T.text, letterSpacing: '-0.01em' }}>
          My Finances
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: T.green }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}`, display: 'inline-block' }} />
            Sandbox · Live
          </div>
          <button onClick={onDisconnect} style={{
            background: 'transparent', border: `1px solid rgba(99,102,241,0.3)`,
            color: T.muted, padding: '0.3rem 0.85rem', borderRadius: '8px',
            fontSize: '0.8rem', letterSpacing: '0.04em', cursor: 'pointer',
            fontFamily: T.sans, transition: 'border-color 0.2s, color 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.color = T.muted; }}
          >Disconnect</button>
        </div>
      </div>

      {error && <div style={{ color: T.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <div style={{ color: T.muted, fontSize: '0.85rem', padding: '2rem 0' }}>Loading your data…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', alignItems: 'start' }}>
          <LeftPanel accounts={accounts} transactions={transactions} />
          <div style={{ height: '600px' }}>
            <RightPanel transactions={transactions} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Link prompt ───────────────────────────────────────────────────────────────
function LinkPrompt({ onLink, ready, linkToken, error }) {
  return (
    <div style={{ fontFamily: T.sans }}>
      <link rel="stylesheet" href={FONT_LINK} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: T.display, fontSize: '1.8rem', color: T.text, margin: '0 0 0.5rem', letterSpacing: '-0.01em' }}>
          Connect your bank
        </h2>
        <p style={{ color: T.muted, fontSize: '0.85rem', letterSpacing: '0.04em', margin: '0 0 2rem', maxWidth: 320 }}>
          Securely link your account with Plaid to view balances and transactions.
        </p>
        {error && <div style={{ color: T.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</div>}
        <button
          onClick={onLink}
          disabled={!ready || !linkToken}
          style={{
            background: T.accentBg,
            border: `1px solid ${T.accentBord}`,
            color: T.accent,
            padding: '0.55rem 1.75rem', borderRadius: '8px',
            fontSize: '0.85rem', letterSpacing: '0.05em',
            fontFamily: T.sans, cursor: ready && linkToken ? 'pointer' : 'not-allowed',
            opacity: ready && linkToken ? 1 : 0.5,
            transition: 'background 0.2s, border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={e => { if (ready && linkToken) { e.currentTarget.style.background = 'rgba(99,102,241,0.3)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.7)'; e.currentTarget.style.color = '#c7d2fe'; }}}
          onMouseLeave={e => { e.currentTarget.style.background = T.accentBg; e.currentTarget.style.borderColor = T.accentBord; e.currentTarget.style.color = T.accent; }}
        >
          {!linkToken ? 'Initializing…' : 'Link bank account'}
        </button>
        <p style={{ marginTop: '1rem', fontSize: '0.72rem', color: T.muted, letterSpacing: '0.04em' }}>🔒 Secured by Plaid · Sandbox mode</p>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function PlaidIntegration() {
  const [linkToken, setLinkToken] = useState(null);
  const [isLinked,  setIsLinked]  = useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    fetch('/api/plaid/create_link_token', { method: 'POST' })
      .then(r => r.json())
      .then(d => setLinkToken(d.link_token))
      .catch(() => setError('Could not fetch link token.'));
  }, []);

  const onSuccess = useCallback(async (public_token) => {
    try {
      const r = await fetch('/api/plaid/set_access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      if (r.ok) setIsLinked(true);
      else {
        const e = await r.json();
        setError(e.error?.display_message || 'Failed to set access token');
      }
    } catch { setError('Token exchange failed.'); }
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  if (isLinked) return <Dashboard onDisconnect={() => setIsLinked(false)} />;
  return <LinkPrompt onLink={() => open()} ready={ready} linkToken={linkToken} error={error} />;
}