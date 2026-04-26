import React, { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { isTransfer } from '../finance/cashflowMath';
import {
  PageScaffold,
  StatGrid,
  StatCard,
  TransactionsTable,
  fmtUSD,
  fmtSignedUSD,
} from '../components/finance-ui';

// Activity page: the only place that owns the full transaction ledger.
// Cashflow and Hub reference this page via compact previews.
export default function FinanceActivity() {
  const { phase, selectedItem, transactions } = useFinanceSession();

  // Summary totals here follow the same transfer-exclusion rule as
  // Cashflow / Hub so the headline numbers agree across pages. The
  // transactions table itself still shows every transaction, including
  // transfers, so users can audit the full ledger.
  const totals = useMemo(() => {
    const list = transactions || [];
    let inc = 0;
    let spent = 0;
    for (const tx of list) {
      if (isTransfer(tx)) continue;
      if (tx.amount < 0) inc += Math.abs(tx.amount);
      else spent += tx.amount;
    }
    return { inc, spent, net: inc - spent, count: list.length };
  }, [transactions]);

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  return (
    <PageScaffold
      eyebrow="Ledger"
      title="Activity"
      description="The full transaction ledger synced from your linked banks. Search, filter, and switch between grouped-by-bank and flat views."
    >
      <StatGrid min={170}>
        <StatCard label="Transactions" value={totals.count} emphasis="secondary" />
        <StatCard
          label="Income"
          value={fmtUSD(totals.inc)}
          sub="Transfers excluded"
          tone="positive"
          emphasis="secondary"
        />
        <StatCard
          label="Spending"
          value={fmtUSD(totals.spent)}
          sub="Transfers excluded"
          emphasis="secondary"
        />
        <StatCard
          label="Net"
          value={fmtSignedUSD(totals.net)}
          tone={totals.net >= 0 ? 'positive' : 'negative'}
          emphasis="secondary"
        />
      </StatGrid>

      <div style={{ marginTop: '1rem' }}>
        <TransactionsTable transactions={transactions} />
      </div>
    </PageScaffold>
  );
}
