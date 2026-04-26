import React, { useState } from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';
import {
  DataViewport,
  PanelCard,
  SegmentedTabs,
  StatCard,
  StatGrid,
  fmtUSD,
  fmtShortDate,
} from '../finance-ui';

const PALETTE = [
  'rgba(165,180,252,0.85)',
  'rgba(134,239,172,0.85)',
  'rgba(253,230,138,0.85)',
  'rgba(252,165,165,0.85)',
  'rgba(196,181,253,0.85)',
  'rgba(125,211,252,0.85)',
];

function AllocationBar({ allocation }) {
  if (!allocation || allocation.length === 0) return null;
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, height: 10, borderRadius: 99, overflow: 'hidden', marginBottom: '0.6rem' }}>
        {allocation.map((seg, i) => (
          <div key={seg.type} style={{
            flex: seg.pct, background: PALETTE[i % PALETTE.length], transition: 'flex 0.5s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem' }}>
        {allocation.map((seg, i) => (
          <div key={seg.type} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', color: T.muted, textTransform: 'capitalize' }}>
              {seg.type} <span style={{ color: T.text, fontWeight: 600 }}>{seg.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoldingRow({ h }) {
  const gain = h.unrealized_gain;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto',
      alignItems: 'center', gap: '0.75rem',
      padding: '0.6rem 1.1rem',
      borderBottom: `1px solid ${T.borderSoft}`,
    }}
      onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: T.font.sm, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {h.ticker_symbol || '—'}
          <span style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 400, marginLeft: 6 }}>{h.name}</span>
        </div>
        <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 1 }}>
          {h.quantity != null ? `${h.quantity} shares` : ''} · {h.security_type || 'unknown'}
        </div>
      </div>
      <span style={{ fontSize: T.font.xs, fontWeight: 600, color: gain == null ? T.muted : gain >= 0 ? T.green : T.red, whiteSpace: 'nowrap' }}>
        {gain == null ? '—' : `${gain >= 0 ? '+' : '-'}${fmtUSD(gain)}`}
      </span>
      <span style={{ fontSize: T.font.sm, fontWeight: 600, color: T.text, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {fmtUSD(h.institution_value)}
      </span>
    </div>
  );
}

function TxRow({ tx }) {
  const typeColors = { buy: T.red, sell: T.green, dividend: T.accent, fee: T.muted };
  const color = typeColors[(tx.type || '').toLowerCase()] || T.text;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto',
      alignItems: 'center', gap: '0.75rem',
      padding: '0.6rem 1.1rem',
      borderBottom: `1px solid ${T.borderSoft}`,
    }}
      onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: T.font.sm, fontWeight: 500, color: T.text }}>
          <span style={{ color, textTransform: 'capitalize', fontWeight: 600 }}>{tx.type || '?'}</span>
          {tx.ticker_symbol ? ` ${tx.ticker_symbol}` : ''}
          {tx.name && !tx.ticker_symbol ? ` — ${tx.name}` : ''}
        </div>
      </div>
      <span style={{ fontSize: T.font.xs, color: T.muted, whiteSpace: 'nowrap' }}>{fmtShortDate(tx.date)}</span>
      <span style={{ fontSize: T.font.sm, fontWeight: 600, color: T.text, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {fmtUSD(tx.amount)}
      </span>
    </div>
  );
}

export default function InvestmentsPanel({ summaryData, holdingsData, txData, loading }) {
  const [tab, setTab] = useState('holdings');

  if (loading) {
    return <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>Loading investments…</div>;
  }
  if (!summaryData && !holdingsData && !txData) {
    return <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>No investment data yet. Sync extended data first.</div>;
  }

  const holdings = holdingsData?.holdings || [];
  const txs = txData?.investment_transactions || [];

  const tabs = [
    { id: 'holdings',     label: 'Holdings', count: holdings.length },
    { id: 'transactions', label: 'Activity', count: txs.length },
  ];

  const totalValue = summaryData?.total_market_value;

  return (
    <div style={{ fontFamily: T.sans, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <StatGrid min={220}>
        <StatCard
          label="Portfolio value"
          value={fmtUSD(totalValue)}
          sub={holdings.length ? `${holdings.length} holdings` : undefined}
        />
        <StatCard
          label="Holdings"
          value={holdings.length}
          emphasis="secondary"
        />
        <StatCard
          label="Recent activity"
          value={txs.length}
          emphasis="secondary"
          sub="Buys, sells, dividends"
        />
      </StatGrid>

      {summaryData?.allocation?.length > 0 && (
        <PanelCard title="Allocation">
          <AllocationBar allocation={summaryData.allocation} />
        </PanelCard>
      )}

      <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />

      <DataViewport
        height="min(60vh, 620px)"
        isEmpty={tab === 'holdings' ? holdings.length === 0 : txs.length === 0}
        emptyState={tab === 'holdings' ? 'No holdings found.' : 'No investment activity found.'}
      >
        {tab === 'holdings' && holdings.map((h, i) => <HoldingRow key={h.security_id || i} h={h} />)}
        {tab === 'transactions' && txs.map((tx, i) => <TxRow key={tx.investment_transaction_id || i} tx={tx} />)}
      </DataViewport>
    </div>
  );
}
