import React, { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FINANCE_T as T, normalizeCategoryLabel } from '../theme/financeTheme';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { computePeriodCashflow } from '../finance/cashflowMath';
import {
  PageScaffold,
  StatGrid,
  StatCard,
  PanelCard,
  MiniPreviewList,
  AccountsBreakdown,
  fmtUSD,
  fmtSignedUSD,
  fmtShortDate,
} from '../components/finance-ui';

// Helper: take the top N recurring streams from the recurring overview.
// Prefers streams with a real monthly-normalized amount so the Hub preview
// only shows bills we were confident enough to roll up to a monthly figure.
function pickTopRecurring(recurringData, key, limit = 4) {
  const list = (recurringData?.[key] || []).filter(
    s => s.is_active !== false && s.monthly_amount != null
  );
  return list
    .slice()
    .sort((a, b) => (b.monthly_amount || 0) - (a.monthly_amount || 0))
    .slice(0, limit);
}

export default function FinanceHub() {
  const navigate = useNavigate();
  const {
    phase,
    selectedItem,
    accounts,
    transactions,
    recurringData,
    liabilitiesData,
    investmentsSummary,
    netWorthData,
    cashflowData,
    insightsData,
    extendedLoading,
  } = useFinanceSession();

  // ── Derive snapshot numbers from context ────────────────────────────
  // Cash-on-hand is now derived from the canonical net-worth breakdown
  // (backend `app.finance.balance_sheet`) so it matches what Net Worth
  // shows exactly. We fall back to summing `account_class === 'cash'`
  // locally while the extended data is still loading.
  const cashTotal = useMemo(() => {
    if (netWorthData?.breakdown?.cash != null) return netWorthData.breakdown.cash;
    const list = accounts || [];
    return list
      .filter(a => (a.account_class || '').toLowerCase() === 'cash')
      .reduce((s, a) => s + (Number(a.balances?.current) || 0), 0);
  }, [accounts, netWorthData]);

  // Income / Spending in the last 30 days. Canonical numbers come from
  // the backend `/cashflow` endpoint (transfers excluded, strict date
  // window). If that hasn't returned yet we mirror the same rules
  // locally via `computePeriodCashflow` so the preview still excludes
  // TRANSFER_IN / TRANSFER_OUT instead of inflating both columns.
  const { income30d, spending30d } = useMemo(() => {
    if (cashflowData) {
      return { income30d: cashflowData.income || 0, spending30d: cashflowData.spending || 0 };
    }
    const cf = computePeriodCashflow(transactions || [], { periodDays: 30 });
    return { income30d: cf.income, spending30d: cf.spending };
  }, [cashflowData, transactions]);

  const netRecurring = recurringData?.summary?.net_recurring;
  const monthlyOut = recurringData?.summary?.total_monthly_outflow;
  const monthlyIn = recurringData?.summary?.total_monthly_inflow;
  const netWorth = netWorthData?.net_worth;
  const totalLiabilities = netWorthData?.total_liabilities;
  const portfolio = investmentsSummary?.total_market_value;
  const safeToSpend = insightsData?.safe_to_spend;

  const topBills = useMemo(() => {
    return pickTopRecurring(recurringData, 'outflow_streams').map(s => ({
      key: s.stream_id || s.merchant_key,
      primary: s.merchant_name,
      secondary: `${s.cadence || s.frequency || 'monthly'} · ${normalizeCategoryLabel(s.personal_finance_category)}`,
      amount: `${fmtUSD(s.monthly_amount)}/mo`,
      tone: 'neg',
    }));
  }, [recurringData]);

  const topIncome = useMemo(() => {
    return pickTopRecurring(recurringData, 'inflow_streams', 3).map(s => ({
      key: s.stream_id || s.merchant_key,
      primary: s.merchant_name,
      secondary: `${s.cadence || s.frequency || 'monthly'}`,
      amount: `+${fmtUSD(s.monthly_amount)}/mo`,
      tone: 'pos',
    }));
  }, [recurringData]);

  const recentActivity = useMemo(() => {
    const list = [...(transactions || [])]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5);
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

  // ── Layout ──────────────────────────────────────────────────────────
  return (
    <PageScaffold
      eyebrow="Overview"
      title="Money hub"
      description="A single-pane view of what you have, what moves in and out, and where to dig deeper."
      showSync
    >
      {/* Headline KPIs */}
      <StatGrid min={200}>
        <StatCard
          label="Net worth"
          value={netWorth == null ? '—' : `${netWorth < 0 ? '-' : ''}${fmtUSD(netWorth)}`}
          sub={extendedLoading ? 'Loading…' : 'Assets − Liabilities'}
          tone={netWorth == null ? 'neutral' : netWorth >= 0 ? 'positive' : 'negative'}
          onClick={() => navigate('/home/net-worth')}
        />
        <StatCard
          label="Cash on hand"
          value={fmtUSD(cashTotal)}
          sub="Across checking / savings"
          tone="positive"
          onClick={() => navigate('/home/activity')}
        />
        <StatCard
          label="Safe to spend"
          value={safeToSpend == null ? '—' : fmtUSD(safeToSpend)}
          sub="Cash − monthly recurring"
          tone={safeToSpend == null ? 'neutral' : safeToSpend >= 0 ? 'positive' : 'negative'}
          onClick={() => navigate('/home/insights')}
        />
        <StatCard
          label="Net recurring"
          value={netRecurring == null ? '—' : fmtSignedUSD(netRecurring)}
          sub={monthlyOut != null ? `Out ${fmtUSD(monthlyOut)} · In ${fmtUSD(monthlyIn || 0)}` : 'Monthly balance'}
          tone={netRecurring == null ? 'neutral' : netRecurring >= 0 ? 'positive' : 'negative'}
          onClick={() => navigate('/home/recurring')}
        />
      </StatGrid>

      {/* Main 2-column grid */}
      <div
        className="fin-two-col fin-two-col--sidebar"
        style={{ marginTop: '1rem', alignItems: 'stretch' }}
      >
        {/* Left column: accounts breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <PanelCard
            title="Accounts"
            subtitle={`${accounts?.length || 0} linked · grouped by type`}
            actions={
              <button
                type="button"
                onClick={() => navigate('/home/net-worth')}
                style={{
                  fontSize: '0.7rem', color: T.accent, background: 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: T.sans, fontWeight: 600,
                }}
              >
                View breakdown →
              </button>
            }
          >
            <AccountsBreakdown accounts={accounts} compact />
          </PanelCard>

          <PanelCard
            title="Portfolio"
            subtitle={investmentsSummary ? undefined : 'Sync extended data to populate'}
            actions={
              <button
                type="button"
                onClick={() => navigate('/home/investments')}
                style={{ fontSize: '0.7rem', color: T.accent, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: T.sans, fontWeight: 600 }}
              >
                Investments →
              </button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontFamily: T.display, fontSize: '1.6rem', color: T.text, letterSpacing: '-0.01em' }}>
                {fmtUSD(portfolio)}
              </span>
              <span style={{ fontSize: T.font.xs, color: T.muted }}>
                {investmentsSummary?.allocation?.length
                  ? investmentsSummary.allocation.slice(0, 3).map(a => `${a.type} ${a.pct}%`).join(' · ')
                  : 'No allocation data yet'}
              </span>
            </div>
          </PanelCard>

          <PanelCard
            title="Debt snapshot"
            actions={
              <button
                type="button"
                onClick={() => navigate('/home/debt')}
                style={{ fontSize: '0.7rem', color: T.accent, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: T.sans, fontWeight: 600 }}
              >
                Liabilities →
              </button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontFamily: T.display, fontSize: '1.6rem', color: T.red, letterSpacing: '-0.01em' }}>
                {totalLiabilities == null ? '—' : `-${fmtUSD(totalLiabilities)}`}
              </span>
              <span style={{ fontSize: T.font.xs, color: T.muted }}>
                Credit {fmtUSD(liabilitiesData?.summary?.total_credit_balance)} ·{' '}
                Student {liabilitiesData?.student_loans?.length || 0} ·{' '}
                Mortgage {liabilitiesData?.mortgages?.length || 0}
              </span>
            </div>
          </PanelCard>
        </div>

        {/* Right column: activity + recurring previews */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
          }}>
            <PanelCard
              title="Top recurring bills"
              subtitle="Highest monthly obligations"
            >
              <MiniPreviewList
                items={topBills}
                emptyText={extendedLoading ? 'Loading recurring…' : 'No confident bills detected yet.'}
                deepLinkTo="/home/recurring"
                deepLinkLabel="All recurring →"
              />
            </PanelCard>
            <PanelCard
              title="Recurring income"
              subtitle="Detected payroll & transfers"
            >
              <MiniPreviewList
                items={topIncome}
                emptyText={extendedLoading ? 'Loading recurring…' : 'No confident income stream yet.'}
                deepLinkTo="/home/recurring"
                deepLinkLabel="All recurring →"
              />
            </PanelCard>
          </div>

          <PanelCard
            title="Recent activity"
            subtitle="Most recent 5 transactions"
          >
            <MiniPreviewList
              items={recentActivity}
              emptyText="No transactions in the last 30 days."
              deepLinkTo="/home/activity"
              deepLinkLabel="Open ledger →"
            />
          </PanelCard>

          <PanelCard
            title="Last 30 days"
            subtitle="Transfers between your own accounts excluded"
          >
            <StatGrid min={150}>
              <StatCard label="Income"   value={fmtUSD(income30d)}   tone="positive" emphasis="secondary" />
              <StatCard label="Spending" value={fmtUSD(spending30d)} emphasis="secondary" />
              <StatCard
                label="Net"
                value={fmtSignedUSD(income30d - spending30d)}
                emphasis="secondary"
                tone={income30d - spending30d >= 0 ? 'positive' : 'negative'}
              />
            </StatGrid>
          </PanelCard>
        </div>
      </div>
    </PageScaffold>
  );
}
