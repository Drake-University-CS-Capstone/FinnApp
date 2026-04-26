import React from 'react';
import { Navigate } from 'react-router-dom';
import { FINANCE_T as T } from '../theme/financeTheme';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import {
  MiniPreviewList,
  PageScaffold,
  PanelCard,
  StatCard,
  StatGrid,
  TrendAreaChart,
  fmtShortDate,
  fmtUSD,
} from '../components/finance-ui';

export default function FinancePlanning() {
  const { phase, selectedItem, financeModel, cashflowPeriodDays } = useFinanceSession();

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  const {
    summary,
    monthlyTrend6,
    upcomingBills,
    recurringBreakdown,
    recurringBills,
    subscriptions,
  } = financeModel;
  const upcomingItems = upcomingBills.slice(0, 4).map((item) => ({
    key: item.key,
    primary: item.title,
    secondary: item.dueDate ? `Due ${fmtShortDate(item.dueDate)}` : item.subtitle,
    amount: `-${fmtUSD(item.amount)}`,
    tone: 'neg',
  }));
  const recurringItems = recurringBills.map((item) => ({
    key: item.key,
    primary: item.title,
    secondary: item.subtitle,
    amount: `${fmtUSD(item.amount)}/mo`,
    tone: 'neg',
  }));
  const subscriptionItems = subscriptions.map((item) => ({
    key: item.key,
    primary: item.title,
    secondary: item.subtitle,
    amount: `${fmtUSD(item.amount)}/mo`,
    tone: 'neg',
  }));

  return (
    <PageScaffold
      eyebrow="Planning"
      title="Planning"
      description="Cash flow, recurring bills, and the few planning signals that matter most in one place."
      showSync={false}
      showSwitchBank={false}
    >
      <StatGrid min={200}>
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
          label="Recurring Bills"
          value={fmtUSD(recurringBreakdown?.billsTotal)}
          sub="Essential recurring obligations"
          tone="accent"
        />
        <StatCard
          label="Recurring Income"
          value={fmtUSD(summary.recurringIncome)}
          sub="Validated monthly inflows"
          tone="positive"
        />
      </StatGrid>

      <div style={{ marginTop: '1rem' }}>
        <PanelCard
          title="Cash Flow Trend"
          subtitle="Income versus expenses over the last 6 months"
          padding="1rem 1rem 0.85rem"
        >
          <TrendAreaChart
            data={monthlyTrend6}
            series={[
              { key: 'income', label: 'Income', color: '#86efac' },
              { key: 'spending', label: 'Expenses', color: '#fca5a5' },
            ]}
            height={390}
          />
        </PanelCard>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <PanelCard
          title="Recurring Commitments"
          subtitle="Monthly obligations split into essential bills and consumer subscriptions"
          padding="1rem"
          fill
        >
          <div className="fin-two-col" style={{ gap: '1.25rem' }}>
          <div style={{
            padding: '0.95rem 1rem',
            borderRadius: T.radius.lg,
            border: `1px solid ${T.borderSoft}`,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline', marginBottom: '0.7rem' }}>
              <div>
                <div style={{ fontSize: T.font.micro, color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Bills
                </div>
                <div style={{ marginTop: 3, fontSize: T.font.xs, color: T.muted }}>
                  Loans, rent, insurance, utilities, and other core obligations
                </div>
              </div>
              <div style={{ fontSize: T.font.sm, color: T.text, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {fmtUSD(recurringBreakdown?.billsTotal)}/mo
              </div>
            </div>
            <MiniPreviewList
              items={recurringItems}
              emptyText="No recurring bills detected yet."
            />
          </div>

          <div style={{
            padding: '0.95rem 1rem',
            borderRadius: T.radius.lg,
            border: `1px solid ${T.borderSoft}`,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline', marginBottom: '0.7rem' }}>
              <div>
                <div style={{ fontSize: T.font.micro, color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Subscriptions
                </div>
                <div style={{ marginTop: 3, fontSize: T.font.xs, color: T.muted }}>
                  Media, memberships, software, and other recurring consumer services
                </div>
              </div>
              <div style={{ fontSize: T.font.sm, color: T.text, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {fmtUSD(recurringBreakdown?.subscriptionsTotal)}/mo
              </div>
            </div>
            <MiniPreviewList
              items={subscriptionItems}
              emptyText="No subscriptions detected yet."
            />
          </div>
          </div>
        </PanelCard>
      </div>

      {upcomingItems.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <PanelCard
            title="Upcoming Bills"
            subtitle="Next due dates that could affect this month"
            padding="0.95rem 1rem"
          >
            <MiniPreviewList
              items={upcomingItems}
              emptyText="No upcoming due dates available yet."
            />
          </PanelCard>
        </div>
      )}
    </PageScaffold>
  );
}
