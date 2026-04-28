import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { normalizeCategoryLabel } from '../theme/financeTheme';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { computePeriodCashflow } from '../finance/cashflowMath';
import { filterTransactionsForRange } from '../finance/financeModel';
import {
  DonutBreakdown,
  PageScaffold,
  PanelCard,
  SegmentedTabs,
  StatCard,
  StatGrid,
  TransactionsTable,
  fmtSignedUSD,
  fmtUSD,
} from '../components/finance-ui';

function rangeDayCount(resolvedRange) {
  if (!resolvedRange?.startDate || !resolvedRange?.endDate) return 30;
  return Math.max(1, Math.ceil((resolvedRange.endDate - resolvedRange.startDate) / (1000 * 60 * 60 * 24)));
}

export default function FinanceTransactions() {
  const {
    phase,
    selectedItem,
    financeModel,
    transactionRange,
    transactionRangeResolved,
    setTransactionRangePreset,
    setTransactionCustomRange,
  } = useFinanceSession();
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [grouping, setGrouping] = useState('grouped');
  const [visibleTransactions, setVisibleTransactions] = useState([]);

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  const { ledger } = financeModel;
  const selectedTransactions = useMemo(
    () => filterTransactionsForRange(ledger.transactions, transactionRange),
    [ledger.transactions, transactionRange],
  );
  useEffect(() => {
    setVisibleTransactions(selectedTransactions);
  }, [selectedTransactions]);

  const selectedCashflow = useMemo(
    () => computePeriodCashflow(selectedTransactions, {
      periodDays: rangeDayCount(transactionRangeResolved),
      now: transactionRangeResolved.endDate,
    }),
    [selectedTransactions, transactionRangeResolved],
  );
  const filteredCashflow = useMemo(
    () => computePeriodCashflow(visibleTransactions, {
      periodDays: rangeDayCount(transactionRangeResolved),
      now: transactionRangeResolved.endDate,
    }),
    [visibleTransactions, transactionRangeResolved],
  );
  const categoryBreakdown = useMemo(
    () => (filteredCashflow.by_category || []).map((entry, index) => ({
      key: `${entry.category}-${index}`,
      label: normalizeCategoryLabel(entry.category),
      value: entry.spending,
      pct: entry.pct_of_spending,
    })),
    [filteredCashflow],
  );
  const workspaceHeight = 'min(78vh, 860px)';

  const rangeControls = (
    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <SegmentedTabs
        size="sm"
        tabs={[
          { id: '30D', label: '30D' },
          { id: '60D', label: '60D' },
          { id: '90D', label: '90D' },
          { id: 'CUSTOM', label: 'Custom' },
        ]}
        value={transactionRange.preset}
        onChange={setTransactionRangePreset}
      />
      {transactionRange.preset === 'CUSTOM' && (
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="fin-input"
            value={transactionRange.customStart || ''}
            onChange={(e) => setTransactionCustomRange(e.target.value, transactionRange.customEnd)}
            style={{
              padding: '0.32rem 0.65rem',
              borderRadius: 999,
              border: '1px solid rgba(99,102,241,0.2)',
              background: 'transparent',
              color: '#e2e8f0',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '0.72rem',
            }}
          />
          <input
            type="date"
            className="fin-input"
            value={transactionRange.customEnd || ''}
            onChange={(e) => setTransactionCustomRange(transactionRange.customStart, e.target.value)}
            style={{
              padding: '0.32rem 0.65rem',
              borderRadius: 999,
              border: '1px solid rgba(99,102,241,0.2)',
              background: 'transparent',
              color: '#e2e8f0',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '0.72rem',
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <PageScaffold
      eyebrow="Ledger"
      title="Transactions"
      description="A cleaner transaction workspace with recent activity first, better spacing, and range controls that keep the table readable."
      showSync={false}
      showSwitchBank={false}
      actions={rangeControls}
    >
      <StatGrid min={210}>
        <StatCard
          label="Inflows"
          value={fmtUSD(selectedCashflow.income)}
          sub={`${transactionRangeResolved.label} · transfers excluded`}
          tone="positive"
        />
        <StatCard
          label="Outflows"
          value={fmtUSD(selectedCashflow.spending)}
          sub={`${transactionRangeResolved.label} · transfers excluded`}
          tone="negative"
        />
        <StatCard
          label="Net"
          value={fmtSignedUSD(selectedCashflow.net)}
          sub={transactionRangeResolved.label}
          tone={selectedCashflow.net >= 0 ? 'positive' : 'negative'}
        />
      </StatGrid>

      <div className="fin-two-col fin-two-col--transactions" style={{ marginTop: '1rem', alignItems: 'stretch' }}>
        <div style={{ minWidth: 0 }}>
          <TransactionsTable
            transactions={selectedTransactions}
            height={workspaceHeight}
            filter={filter}
            onFilterChange={setFilter}
            query={query}
            onQueryChange={setQuery}
            grouping={grouping}
            onGroupingChange={setGrouping}
            onFilteredChange={setVisibleTransactions}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0, height: workspaceHeight }}>
          <PanelCard title="Spending by Category" subtitle="Visible filtered results" fill>
            <DonutBreakdown
              data={categoryBreakdown}
              centerLabel="Outflows"
              centerValue={fmtUSD(filteredCashflow.spending || 0)}
              height={240}
              legendPosition="bottom"
            />
          </PanelCard>
        </div>
      </div>
    </PageScaffold>
  );
}
