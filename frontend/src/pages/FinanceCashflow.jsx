import React, { useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { FINANCE_T as T, normalizeCategoryLabel } from '../theme/financeTheme';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { computePeriodCashflow, isTransfer } from '../finance/cashflowMath';
import {
  PageScaffold,
  StatGrid,
  StatCard,
  PanelCard,
  MiniPreviewList,
  fmtUSD,
  fmtSignedUSD,
  fmtShortDate,
} from '../components/finance-ui';

// Cashflow page: the "how is money moving" analysis. It owns trend bars,
// category breakdowns, and safe-to-spend. The full transaction list lives
// only on Activity; the full recurring list lives only on Recurring.
//
// All numeric totals here come from the canonical backend /cashflow endpoint
// (via `cashflowData` in context). Transfers between the user's own accounts
// are excluded from both Income and Spending there; we mirror the same rule
// locally via `computePeriodCashflow` only as a fallback before the backend
// responds.
export default function FinanceCashflow() {
  const {
    phase,
    selectedItem,
    transactions,
    recurringData,
    cashflowData,
    insightsData,
    extendedLoading,
  } = useFinanceSession();

  const { income30d, spending30d, byCat } = useMemo(() => {
    const source =
      cashflowData ||
      computePeriodCashflow(transactions || [], { periodDays: 30 });
    const topCats = (source.by_category || [])
      .slice(0, 6)
      .map(c => [normalizeCategoryLabel(c.category), c.spending]);
    return {
      income30d: source.income || 0,
      spending30d: source.spending || 0,
      byCat: topCats,
    };
  }, [cashflowData, transactions]);

  // The recent-transactions preview strips transfers too so the user
  // doesn't see "paid my own credit card" dominating the list.
  const preview = useMemo(() => {
    const list = [...(transactions || [])]
      .filter(tx => !isTransfer(tx))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 6);
    return list.map(tx => ({
      key: tx.transaction_id,
      primary: tx.name || '—',
      secondary: `${fmtShortDate(tx.date)} · ${normalizeCategoryLabel(tx.category)}`,
      amount: `${tx.amount < 0 ? '+' : '-'}${fmtUSD(tx.amount)}`,
      tone: tx.amount < 0 ? 'pos' : 'neutral',
    }));
  }, [transactions]);

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  const netRecurring = recurringData?.summary?.net_recurring;
  const monthlyOut = recurringData?.summary?.total_monthly_outflow;
  const monthlyIn = recurringData?.summary?.total_monthly_inflow;
  const safeToSpend = insightsData?.safe_to_spend;
  const spent = spending30d || 0;
  const maxCat = byCat[0]?.[1] || 1;

  return (
    <PageScaffold
      eyebrow="Analysis"
      title="Cashflow"
      description="Income and spending over the last 30 days (transfers between your own accounts excluded) plus your committed recurring obligations."
      showSync
    >
      <StatGrid min={200}>
        <StatCard
          label="Income · 30d"
          value={fmtUSD(income30d)}
          sub="True inflows, transfers excluded"
          tone="positive"
        />
        <StatCard
          label="Spending · 30d"
          value={fmtUSD(spending30d)}
          sub="True outflows, transfers excluded"
        />
        <StatCard
          label="Net recurring"
          value={netRecurring == null ? '—' : fmtSignedUSD(netRecurring)}
          sub={monthlyOut != null ? `In ${fmtUSD(monthlyIn || 0)} · Out ${fmtUSD(monthlyOut)}` : 'Monthly balance of recurring'}
          tone={netRecurring == null ? 'neutral' : netRecurring >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Safe to spend"
          value={safeToSpend == null ? '—' : fmtUSD(safeToSpend)}
          sub="Cash − monthly recurring"
          tone={safeToSpend == null ? 'neutral' : safeToSpend >= 0 ? 'positive' : 'negative'}
        />
      </StatGrid>

      <div className="fin-two-col" style={{ marginTop: '1rem' }}>
        <PanelCard title="Top spending categories" subtitle="Last 30 days">
          {byCat.length === 0 ? (
            <div style={{ fontSize: T.font.sm, color: T.muted, padding: '0.75rem 0' }}>
              No outflows recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {byCat.map(([label, amount]) => {
                const pctOfMax = (amount / maxCat) * 100;
                const pctOfTotal = spent ? (amount / spent) * 100 : 0;
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.font.xs, marginBottom: 3 }}>
                      <span style={{ color: T.text, fontWeight: 500 }}>{label}</span>
                      <span style={{ color: T.muted }}>
                        {fmtUSD(amount)} <span style={{ color: T.mutedDeep }}>· {Math.round(pctOfTotal)}%</span>
                      </span>
                    </div>
                    <div style={{ height: 5, background: T.borderSoft, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pctOfMax}%`,
                        background: 'linear-gradient(90deg, rgba(99,102,241,0.6), rgba(165,180,252,0.85))',
                        borderRadius: 99,
                        transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>

        <PanelCard
          title="Recent transactions"
          subtitle="Preview — full ledger lives on Activity"
          actions={
            <Link
              to="/home/activity"
              style={{
                fontSize: '0.7rem', color: T.accent, textDecoration: 'none',
                fontWeight: 600, fontFamily: T.sans, letterSpacing: '0.03em',
              }}
            >
              Ledger →
            </Link>
          }
        >
          <MiniPreviewList items={preview} emptyText={extendedLoading ? 'Loading…' : 'No recent transactions.'} />
        </PanelCard>
      </div>
    </PageScaffold>
  );
}
