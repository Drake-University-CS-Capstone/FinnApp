import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { PageScaffold } from '../components/finance-ui';
import InsightsPanel from '../components/extended/InsightsPanel';

// Insights page: recommendations, alerts, and interpretive summaries only.
// Recurring totals, full debt detail, and transaction lists have dedicated
// homes; this page only highlights what needs attention.
export default function FinanceInsights() {
  const { phase, selectedItem, insightsData, extendedLoading } = useFinanceSession();

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  return (
    <PageScaffold
      eyebrow="Recommendations"
      title="Insights"
      description="Interpretive nudges and alerts derived from your linked data. Treat these as guidance, not financial advice."
      maxWidth={960}
      showSync
    >
      <InsightsPanel data={insightsData} loading={extendedLoading} />
    </PageScaffold>
  );
}
