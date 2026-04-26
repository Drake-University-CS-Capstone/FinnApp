import React from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';
import { PanelCard, StatCard, StatGrid, fmtUSD } from '../finance-ui';

function Row({ label, value, color, indent }) {
  const display = value == null ? '—' : fmtUSD(value);
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingLeft: indent ? '1rem' : 0,
      paddingTop: '0.3rem', paddingBottom: '0.3rem',
    }}>
      <span style={{ fontSize: indent ? T.font.xs : T.font.sm, color: indent ? T.muted : T.text, fontWeight: indent ? 400 : 500 }}>
        {label}
      </span>
      <span style={{
        fontSize: indent ? T.font.xs : T.font.sm,
        fontWeight: 600,
        color: color || T.text,
      }}>
        {color === T.red && value ? '-' : ''}{display}
      </span>
    </div>
  );
}

// Simple horizontal stacked bar comparing assets vs liabilities so the
// balance sheet feel is intuitive without a charting library.
function AssetsLiabilitiesBar({ assets, liabilities }) {
  const total = Math.max(1, (assets || 0) + (liabilities || 0));
  const aPct = ((assets || 0) / total) * 100;
  const lPct = ((liabilities || 0) / total) * 100;
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 10, borderRadius: 99, overflow: 'hidden' }}>
        {aPct > 0 && <div style={{ flex: aPct, background: 'rgba(134,239,172,0.8)' }} />}
        {lPct > 0 && <div style={{ flex: lPct, background: 'rgba(252,165,165,0.8)' }} />}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: '0.4rem', fontSize: T.font.xs, color: T.muted,
      }}>
        <span><span style={{ color: T.green }}>●</span> Assets {Math.round(aPct)}%</span>
        <span><span style={{ color: T.red }}>●</span> Liabilities {Math.round(lPct)}%</span>
      </div>
    </div>
  );
}

export default function NetWorthPanel({ data, loading }) {
  if (loading) {
    return <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>Loading net worth…</div>;
  }
  if (!data) {
    return <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>No net worth data yet. Sync extended data first.</div>;
  }

  const nw = data.net_worth;
  const b = data.breakdown || {};
  const nwTone = nw == null ? 'neutral' : nw >= 0 ? 'positive' : 'negative';
  const assets = data.total_assets;
  const liabilities = data.total_liabilities;

  return (
    <div style={{ fontFamily: T.sans, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <StatGrid min={210}>
        <StatCard
          label="Net worth"
          value={nw == null ? '—' : `${nw < 0 ? '-' : ''}${fmtUSD(nw)}`}
          tone={nwTone}
          sub="Assets minus liabilities"
        />
        <StatCard
          label="Total assets"
          value={fmtUSD(assets)}
          tone="positive"
          emphasis="secondary"
        />
        <StatCard
          label="Total liabilities"
          value={liabilities == null ? '—' : `-${fmtUSD(liabilities)}`}
          tone="negative"
          emphasis="secondary"
        />
      </StatGrid>

      <PanelCard title="Assets vs liabilities" subtitle="Proportional view">
        <AssetsLiabilitiesBar assets={assets} liabilities={liabilities} />
      </PanelCard>

      <PanelCard title="Breakdown">
        {/* Assets */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Row label="Assets" value={assets} color={T.green} />
          <Row label="Cash & deposits" value={b.cash} indent />
          <Row label="Investments" value={b.investments} indent />
        </div>

        <div style={{ height: 1, background: T.borderSoft, margin: '0.7rem 0' }} />

        {/* Liabilities */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Row label="Liabilities" value={liabilities} color={T.red} />
          {(b.credit_debt ?? 0) > 0   && <Row label="Credit cards" value={b.credit_debt} color={T.red} indent />}
          {(b.student_debt ?? 0) > 0  && <Row label="Student loans" value={b.student_debt} color={T.red} indent />}
          {(b.mortgage_debt ?? 0) > 0 && <Row label="Mortgage" value={b.mortgage_debt} color={T.red} indent />}
          {(b.other_debt ?? 0) > 0    && <Row label="Other debt" value={b.other_debt} color={T.red} indent />}
        </div>

        <div style={{ height: 1, background: T.borderSoft, margin: '0.7rem 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: T.font.md, fontWeight: 700, color: T.text }}>Net worth</span>
          <span style={{ fontFamily: T.display, fontSize: '1.4rem', color: nw >= 0 ? T.green : T.red, fontWeight: 700 }}>
            {nw == null ? '—' : `${nw < 0 ? '-' : '+'}${fmtUSD(nw)}`}
          </span>
        </div>
      </PanelCard>
    </div>
  );
}
