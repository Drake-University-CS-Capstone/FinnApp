import React from 'react';
import { Link } from 'react-router-dom';
import { FINANCE_T as T } from '../../theme/financeTheme';
import {
  PanelCard,
  StatCard,
  StatGrid,
  fmtUSD,
} from '../finance-ui';

function NudgeCard({ nudge }) {
  const colorMap = {
    alert:   { fg: T.red,    bg: T.redBg,    border: 'rgba(252,165,165,0.3)' },
    warning: { fg: T.yellow, bg: T.yellowBg, border: 'rgba(253,230,138,0.3)' },
    info:    { fg: T.accent, bg: T.accentBg, border: T.accentBord },
  };
  const c = colorMap[nudge.severity] || colorMap.info;
  const labelBySeverity = { alert: 'Alert', warning: 'Warning', info: 'Tip' };
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      padding: '0.85rem 1rem', borderRadius: T.radius.md,
      background: c.bg, border: `1px solid ${c.border}`,
    }}>
      <span style={{
        display: 'inline-block',
        padding: '0.15rem 0.55rem', borderRadius: T.radius.pill,
        background: 'rgba(13,20,36,0.35)', color: c.fg,
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.09em',
        textTransform: 'uppercase', flexShrink: 0, marginTop: 2,
      }}>
        {labelBySeverity[nudge.severity] || 'Info'}
      </span>
      <span style={{ fontSize: T.font.sm, color: T.text, lineHeight: 1.5 }}>
        {nudge.message}
      </span>
    </div>
  );
}

function ProgressBar({ pct, color }) {
  const clamped = Math.min(100, Math.max(0, pct || 0));
  return (
    <div style={{ height: 6, background: T.borderSoft, borderRadius: 99, overflow: 'hidden', marginTop: '0.4rem' }}>
      <div style={{
        height: '100%', width: `${clamped}%`,
        background: color || 'linear-gradient(90deg, rgba(99,102,241,0.6), rgba(165,180,252,0.8))',
        borderRadius: 99, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  );
}

// Insights page panel: recommendations / alerts / interpretations only.
// No recurring or debt totals (those belong on their home pages).
export default function InsightsPanel({ data, loading }) {
  if (loading) {
    return (
      <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>
        Loading insights…
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>
        No insights yet. Sync your extended data to see personalized recommendations.
      </div>
    );
  }

  const util = data.credit_utilization_pct;
  const efRatio = data.emergency_fund_ratio;
  const efPct = efRatio != null ? Math.min(100, efRatio * 100) : null;
  const utilColor = util == null ? null : util > 60 ? T.red : util > 30 ? T.yellow : T.green;
  const efColor = efRatio == null ? null : efRatio >= 1 ? T.green : efRatio >= 0.5 ? T.yellow : T.red;

  const nudges = data.nudges || [];

  return (
    <div style={{ fontFamily: T.sans, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hero: a few interpretive headline metrics that are unique to Insights */}
      <StatGrid min={200}>
        <StatCard
          label="Safe to spend"
          value={fmtUSD(data.safe_to_spend)}
          sub="Cash − monthly recurring"
          tone={data.safe_to_spend == null ? 'neutral' : data.safe_to_spend >= 0 ? 'positive' : 'negative'}
        />
        {util != null && (
          <StatCard
            label="Credit utilization"
            value={`${util}%`}
            sub="Target: below 30%"
            accent={utilColor}
          />
        )}
        {efRatio != null && (
          <StatCard
            label="Emergency fund"
            value={`${Math.round(efPct)}%`}
            sub="of 3-month target"
            accent={efColor}
          />
        )}
      </StatGrid>

      {/* Emergency fund detail */}
      {efPct != null && (
        <PanelCard title="Emergency fund progress">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: T.font.xs, color: T.muted }}>
              Cash on hand: {fmtUSD(data.depository_balance)}
            </span>
            <span style={{ fontSize: T.font.xs, color: efColor, fontWeight: 600 }}>
              Target: {fmtUSD(data.emergency_fund_target)}
            </span>
          </div>
          <ProgressBar pct={efPct} color={efColor ? `linear-gradient(90deg, ${efColor}99, ${efColor})` : undefined} />
        </PanelCard>
      )}

      {/* Nudges */}
      <PanelCard
        title="Recommendations"
        subtitle={nudges.length ? `${nudges.length} active` : 'Nothing pressing right now'}
      >
        {nudges.length === 0 ? (
          <div style={{ fontSize: T.font.sm, color: T.muted, padding: '0.5rem 0' }}>
            No alerts or warnings at the moment. Check back after syncing recent activity.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {nudges.map((n, i) => <NudgeCard key={i} nudge={n} />)}
          </div>
        )}
      </PanelCard>

      {/* Upcoming payments — unique to insights because it combines recurring
          and liabilities signals. The full recurring list still lives on the
          Recurring page. */}
      {data.upcoming_payments?.length > 0 && (
        <PanelCard
          title="Upcoming payments"
          subtitle="Next few scheduled obligations"
          actions={
            <Link to="/home/debt" style={{ fontSize: '0.7rem', color: T.accent, textDecoration: 'none', fontWeight: 600 }}>
              Debt details →
            </Link>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.upcoming_payments.map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0', borderBottom: `1px solid ${T.borderSoft}`,
              }}>
                <div>
                  <span style={{ fontSize: T.font.sm, color: T.text, textTransform: 'capitalize' }}>
                    {p.type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: T.font.xs, color: T.muted, marginLeft: '0.5rem' }}>due {p.due_date}</span>
                </div>
                <span style={{ fontSize: T.font.sm, fontWeight: 600, color: T.red }}>{fmtUSD(p.amount)}</span>
              </div>
            ))}
          </div>
        </PanelCard>
      )}
    </div>
  );
}
