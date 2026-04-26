import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { PageScaffold } from '../components/finance-ui';
import LiabilitiesPanel from '../components/extended/LiabilitiesPanel';

// Debt page: the canonical home for liabilities. Credit cards, student
// loans, mortgages, and other debt accounts all live here with payment
// fields. Hub/Net Worth only show the summary totals.
export default function FinanceDebt() {
  const { phase, selectedItem, liabilitiesData, extendedLoading } = useFinanceSession();

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  return (
    <PageScaffold
      eyebrow="Liabilities"
      title="Debt"
      description="Balances, due dates, APR, and payment details for your liabilities. Requires Plaid liabilities consent for the richest detail."
      maxWidth={1100}
      showSync
    >
      <LiabilitiesPanel data={liabilitiesData} loading={extendedLoading} />
    </PageScaffold>
  );
}
