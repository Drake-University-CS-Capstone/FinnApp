import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { PageScaffold } from '../components/finance-ui';
import InvestmentsPanel from '../components/extended/InvestmentsPanel';

// Investments page: canonical home for portfolio value, allocation, and
// holdings detail. Hub shows a summary card only.
export default function FinanceInvestments() {
  const {
    phase,
    selectedItem,
    investmentsSummary,
    investmentsHoldings,
    investmentsTx,
    extendedLoading,
  } = useFinanceSession();

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  return (
    <PageScaffold
      eyebrow="Portfolio"
      title="Investments"
      description="Total market value, allocation, and holdings across linked investment accounts. Sandbox trades and corporate actions can look synthetic."
      maxWidth={1100}
      showSync
    >
      <InvestmentsPanel
        summaryData={investmentsSummary}
        holdingsData={investmentsHoldings}
        txData={investmentsTx}
        loading={extendedLoading}
      />
    </PageScaffold>
  );
}
