import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { PageScaffold } from '../components/finance-ui';
import RecurringPanel from '../components/extended/RecurringPanel';

// Recurring page: dedicated to recurring bills, subscriptions, and income
// streams. Summary numbers only appear here; other pages reference via the
// compact Hub/Cashflow stat tiles.
export default function FinanceRecurring() {
  const { phase, selectedItem, recurringData, extendedLoading } = useFinanceSession();

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  return (
    <PageScaffold
      eyebrow="Obligations"
      title="Recurring"
      description="Bills, subscriptions, and income streams validated by a hybrid detector. Streams that don't clear the confidence bar are intentionally hidden."
      maxWidth={1000}
      showSync
    >
      <RecurringPanel data={recurringData} loading={extendedLoading} />
    </PageScaffold>
  );
}
