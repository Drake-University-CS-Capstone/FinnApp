import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import {
  ComparisonBars,
  DonutBreakdown,
  PageScaffold,
  PanelCard,
  StatCard,
  StatGrid,
  TrendAreaChart,
  fmtSignedUSD,
  fmtUSD,
} from '../components/finance-ui';

export default function FinanceNetWorth() {
  const { phase, selectedItem, financeModel } = useFinanceSession();

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  const { summary, assetMix, liabilityBreakdown, netWorthTrend } = financeModel;
  const balanceSheetComparison = [
    { key: 'assets', label: 'Assets', value: summary.totalAssets, color: '#86efac' },
    { key: 'liabilities', label: 'Liabilities', value: summary.totalLiabilities, color: '#fca5a5' },
  ];
  const delta = netWorthTrend.length >= 2
    ? netWorthTrend[netWorthTrend.length - 1].netWorth - netWorthTrend[netWorthTrend.length - 2].netWorth
    : null;

  return (
    <PageScaffold
      eyebrow="Balance Sheet"
      title="Net Worth"
      description="A clean accounting view of assets minus liabilities, with current breakdowns separated from estimated history."
      showSync={false}
      showSwitchBank={false}
    >
      <StatGrid min={220}>
        <StatCard
          label="Net Worth"
          value={fmtSignedUSD(summary.netWorth)}
          sub={delta == null ? 'Current balance sheet' : `Month-over-month ${fmtSignedUSD(delta)}`}
          tone={summary.netWorth >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Total Assets"
          value={fmtUSD(summary.totalAssets)}
          sub="Cash, investments, and retirement"
          tone="positive"
        />
        <StatCard
          label="Total Liabilities"
          value={fmtUSD(summary.totalLiabilities)}
          sub="Credit cards, loans, and mortgages"
          tone="negative"
        />
      </StatGrid>

      <div className="fin-two-col" style={{ marginTop: '1rem' }}>
        <PanelCard
          title="Net Worth Trend"
          subtitle="Estimated from the current balance sheet and the last 12 months of net cash flow."
        >
          <TrendAreaChart
            data={netWorthTrend}
            series={[{ key: 'netWorth', label: 'Net Worth', color: summary.netWorth >= 0 ? '#86efac' : '#fca5a5' }]}
            xAxisInterval={0}
          />
        </PanelCard>

        <PanelCard title="Assets vs Liabilities" subtitle="Current balance sheet totals">
          <ComparisonBars data={balanceSheetComparison} />
        </PanelCard>
      </div>

      <div className="fin-two-col" style={{ marginTop: '1rem' }}>
        <PanelCard title="Asset Breakdown" subtitle="Current total assets by group">
          <DonutBreakdown
            data={assetMix}
            centerLabel="Assets"
            centerValue={fmtUSD(summary.totalAssets)}
          />
        </PanelCard>

        <PanelCard title="Liability Breakdown" subtitle="Current liabilities by debt type">
          <ComparisonBars
            data={liabilityBreakdown.map((item, index) => ({
              ...item,
              color: ['#fca5a5', '#fb7185', '#f97316', '#fbbf24', '#a78bfa', '#94a3b8'][index % 6],
            }))}
            layout="vertical"
          />
        </PanelCard>
      </div>
    </PageScaffold>
  );
}
