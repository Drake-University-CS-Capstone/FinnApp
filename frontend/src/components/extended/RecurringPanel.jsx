import React, { useState } from 'react';
import { FINANCE_T as T, normalizeCategoryLabel } from '../../theme/financeTheme';
import {
  DataViewport,
  SegmentedTabs,
  StatCard,
  StatGrid,
  fmtUSD,
  fmtSignedUSD,
} from '../finance-ui';

const CADENCE_LABEL = {
  weekly: 'Weekly',
  biweekly: 'Every 2 wks',
  semimonthly: 'Twice monthly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Yearly',
};

function StreamRow({ stream, isIncome }) {
  const cadenceLabel = CADENCE_LABEL[stream.cadence] || stream.frequency || 'Unknown cadence';
  // Only show a monthly-normalized figure when the detector actually
  // computed one. When `monthly_amount` is null the cadence wasn't known
  // well enough to normalize; we show the raw average with a non-monthly
  // label so the UI stops silently claiming a monthly total.
  const hasMonthly = stream.monthly_amount != null;
  const displayAmount = hasMonthly ? stream.monthly_amount : stream.average_amount;

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.65rem 1.1rem',
      borderBottom: `1px solid ${T.borderSoft}`,
      transition: 'background 0.12s',
      opacity: stream.is_active === false ? 0.55 : 1,
    }}
      onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: T.font.sm, fontWeight: 500, color: T.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {stream.merchant_name}
        </div>
        <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 2 }}>
          {cadenceLabel}
          {stream.personal_finance_category && (
            <span> · {normalizeCategoryLabel(stream.personal_finance_category)}</span>
          )}
          {stream.occurrence_count != null && (
            <span> · {stream.occurrence_count}× seen</span>
          )}
          {stream.is_active === false && (
            <span style={{ color: T.red, marginLeft: 4 }}> · inactive</span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', paddingLeft: '0.75rem' }}>
        <span style={{ fontSize: T.font.sm, fontWeight: 600, color: isIncome ? T.green : T.text }}>
          {isIncome ? '+' : '-'}{fmtUSD(displayAmount)}
          <span style={{ fontSize: '0.68rem', fontWeight: 400, color: T.muted }}>
            {hasMonthly ? '/mo' : ' avg'}
          </span>
        </span>
      </div>
    </div>
  );
}

export default function RecurringPanel({ data, loading, viewportHeight = 'min(56vh, 560px)' }) {
  const [tab, setTab] = useState('outflow');
  const [showInactive, setShowInactive] = useState(false);

  if (loading) {
    return (
      <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>
        Loading recurring streams…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>
        No recurring data yet. Sync extended data first.
      </div>
    );
  }

  const allOutflows = data.outflow_streams || [];
  const allInflows = data.inflow_streams || [];
  const outflows = showInactive ? allOutflows : allOutflows.filter(s => s.is_active !== false);
  const inflows = showInactive ? allInflows : allInflows.filter(s => s.is_active !== false);
  const summary = data.summary || {};

  const active = tab === 'outflow' ? outflows : inflows;
  const totalInactive =
    allOutflows.filter(s => s.is_active === false).length +
    allInflows.filter(s => s.is_active === false).length;

  const tabs = [
    { id: 'outflow', label: 'Bills', count: outflows.length },
    { id: 'inflow',  label: 'Income', count: inflows.length },
  ];

  const stickyHeader = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '0.75rem', flexWrap: 'wrap',
    }}>
      <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />
      {totalInactive > 0 && (
        <button
          type="button"
          onClick={() => setShowInactive(v => !v)}
          style={{
            padding: '0.25rem 0.8rem', borderRadius: T.radius.pill,
            fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em',
            border: `1px dashed ${showInactive ? T.accentBord : T.borderSoft}`,
            background: showInactive ? T.accentBg : 'transparent',
            color: showInactive ? T.accent : T.muted,
            cursor: 'pointer', fontFamily: T.sans,
          }}
        >
          {showInactive ? 'Hide inactive' : `Show inactive (${totalInactive})`}
        </button>
      )}
    </div>
  );

  return (
    <div style={{ fontFamily: T.sans, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <StatGrid min={180}>
        <StatCard
          label="Monthly obligations"
          value={fmtUSD(summary.total_monthly_outflow)}
          sub="Validated recurring · normalized /mo"
        />
        <StatCard
          label="Monthly income"
          value={fmtUSD(summary.total_monthly_inflow)}
          sub="Recurring only (payroll, etc.)"
          tone="positive"
        />
        <StatCard
          label="Net recurring"
          value={summary.net_recurring == null ? '—' : fmtSignedUSD(summary.net_recurring)}
          sub="Income − obligations"
          tone={summary.net_recurring == null ? 'neutral' : summary.net_recurring >= 0 ? 'positive' : 'negative'}
        />
      </StatGrid>

      <DataViewport
        height={viewportHeight}
        stickyHeader={stickyHeader}
        isEmpty={active.length === 0}
        emptyState={`No confident ${tab === 'outflow' ? 'bills' : 'income'} detected. Detection prefers false negatives over false positives.`}
      >
        {active.map((s, i) => (
          <StreamRow
            key={s.stream_id || `${s.merchant_key}-${i}`}
            stream={s}
            isIncome={tab === 'inflow'}
          />
        ))}
      </DataViewport>
    </div>
  );
}
