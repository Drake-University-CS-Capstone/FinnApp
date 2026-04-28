import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import {
  DonutBreakdown,
  MiniPreviewList,
  PageScaffold,
  PanelCard,
  StatCard,
  StatGrid,
  TrendAreaChart,
  fmtShortDate,
  fmtUSD,
} from '../components/finance-ui';

export default function FinanceDashboard() {
  const { phase, selectedItem, financeModel, cashflowPeriodDays } = useFinanceSession();

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  const {
    summary,
    cashTrend3m,
    dashboardCategoryBreakdown,
    upcomingBills,
    recentTransactions,
    financialSnapshot,
    billsDueSummary,
  } = financeModel;
  const upcomingItems = upcomingBills.map((item) => ({
    key: item.key,
    primary: item.title,
    secondary: item.dueDate ? `Due ${fmtShortDate(item.dueDate)}` : item.subtitle,
    amount: `-${fmtUSD(item.amount)}`,
    tone: 'neg',
  }));
  const recentItems = recentTransactions.map((item) => ({
    key: item.key,
    primary: item.title,
    secondary: item.date ? `${fmtShortDate(item.date)} · ${item.subtitle}` : item.subtitle,
    amount: `${item.amount < 0 ? '+' : '-'}${fmtUSD(item.amount)}`,
    tone: item.amount < 0 ? 'pos' : 'neutral',
  }));

  return (
    <PageScaffold
      eyebrow="Overview"
      title="Dashboard"
      description="A lighter daily overview focused on cash, recent activity, and the bills most likely to affect you next."
      showSync={false}
      showSwitchBank={false}
    >
      <StatGrid min={210}>
        <StatCard
          label="Cash Available"
          value={fmtUSD(summary.cashOnHand)}
          sub="Checking, savings, and liquid cash"
          tone="positive"
        />
        <StatCard
          label="Monthly Income"
          value={fmtUSD(summary.monthlyIncome)}
          sub={`Last ${cashflowPeriodDays} days · true inflows`}
          tone="positive"
        />
        <StatCard
          label="Monthly Spending"
          value={fmtUSD(summary.monthlySpending)}
          sub={`Last ${cashflowPeriodDays} days · transfers excluded`}
          tone="negative"
        />
        <StatCard
          label="Bills Due This Month"
          value={fmtUSD(billsDueSummary.total)}
          sub={`${billsDueSummary.count} bill${billsDueSummary.count === 1 ? '' : 's'} due`}
          tone="accent"
        />
      </StatGrid>

      <div className="fin-two-col" style={{ marginTop: '1rem', alignItems: 'stretch' }}>
        <PanelCard
          title="Cash Account Trend"
          subtitle="Checking and savings balances over the last 3 months"
          fill
        >
          <TrendAreaChart
            data={cashTrend3m}
            series={[
              { key: 'checking', label: 'Checking', color: '#86efac' },
              { key: 'savings', label: 'Savings', color: '#818cf8' },
            ]}
            height={300}
          />
        </PanelCard>

        <PanelCard title="Spending by Category" subtitle={`Last ${cashflowPeriodDays} days`} fill>
          <DonutBreakdown
            data={dashboardCategoryBreakdown}
            centerLabel="Outflows"
            centerValue={fmtUSD(summary.monthlySpending)}
            height={220}
          />
        </PanelCard>
      </div>

      <div
        style={{
          marginTop: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        <PanelCard
          title="Recent Transactions"
          subtitle="Most recent activity across your linked accounts"
        >
          <MiniPreviewList
            items={recentItems}
            emptyText="No recent transactions available yet."
            deepLinkTo="/home/transactions"
            deepLinkLabel="View all transactions →"
          />
        </PanelCard>

        <PanelCard
          title="Upcoming Bills"
          subtitle="Next scheduled due dates from liabilities"
          footer={upcomingItems.length ? `${upcomingItems.length} upcoming payment${upcomingItems.length !== 1 ? 's' : ''}` : undefined}
        >
          <MiniPreviewList
            items={upcomingItems}
            emptyText="No scheduled payments available yet."
            deepLinkTo="/home/planning"
            deepLinkLabel="Open planning →"
          />
        </PanelCard>

        <PanelCard title="Financial Snapshot" subtitle="Secondary balance-sheet summary">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {financialSnapshot.map((item) => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.label}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: item.tone === 'negative' ? '#fca5a5' : '#e2e8f0' }}>
                  {item.key === 'net-worth'
                    ? `${item.value >= 0 ? '+' : '-'}${fmtUSD(item.value)}`
                    : fmtUSD(item.value)}
                </span>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </PageScaffold>
  );
}
