import React from 'react';
import { Navigate } from 'react-router-dom';
import { FINANCE_T as T } from '../theme/financeTheme';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import {
  PageScaffold,
  PanelCard,
  fmtSignedUSD,
} from '../components/finance-ui';

export default function FinanceSettings() {
  const {
    phase,
    selectedItem,
    plaidItems,
    financeModel,
    handleAddNewBank,
    handleBackToBanks,
    handleSyncExtended,
    extendedSyncing,
    cashflowPeriodDays,
  } = useFinanceSession();

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  return (
    <PageScaffold
      eyebrow="Workspace"
      title="Settings"
      description="Manage linked institutions, refresh extended Plaid data, and review the calculation rules the dashboard is using."
      showSync={false}
      showSwitchBank={false}
      maxWidth={1000}
    >
      <div className="fin-two-col">
        <PanelCard title="Linked Banks" subtitle="Manage connections and resync account coverage">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(plaidItems || []).map((item) => (
              <div
                key={item._id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  alignItems: 'center',
                  padding: '0.75rem 0',
                  borderBottom: `1px solid ${T.borderSoft}`,
                }}
              >
                <div>
                  <div style={{ fontSize: T.font.sm, color: T.text, fontWeight: 600 }}>
                    {item.institutionName || 'Bank'}
                  </div>
                  <div style={{ fontSize: T.font.xs, color: T.muted }}>
                    Institution ID: {item.institutionId || 'Unknown'}
                  </div>
                </div>
                <div style={{ fontSize: T.font.xs, color: T.muted }}>
                  Connected
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleAddNewBank}
                style={{
                  borderRadius: T.radius.pill,
                  border: `1px solid ${T.accentBord}`,
                  background: T.accentBg,
                  color: T.accentStrong,
                  padding: '0.45rem 0.9rem',
                  cursor: 'pointer',
                  fontFamily: T.sans,
                  fontSize: T.font.xs,
                  fontWeight: 600,
                }}
              >
                Add bank
              </button>
              <button
                type="button"
                onClick={handleBackToBanks}
                style={{
                  borderRadius: T.radius.pill,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.textDim,
                  padding: '0.45rem 0.9rem',
                  cursor: 'pointer',
                  fontFamily: T.sans,
                  fontSize: T.font.xs,
                  fontWeight: 600,
                }}
              >
                Manage banks
              </button>
              <button
                type="button"
                onClick={handleSyncExtended}
                disabled={extendedSyncing}
                style={{
                  borderRadius: T.radius.pill,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: extendedSyncing ? T.muted : T.textDim,
                  padding: '0.45rem 0.9rem',
                  cursor: extendedSyncing ? 'not-allowed' : 'pointer',
                  fontFamily: T.sans,
                  fontSize: T.font.xs,
                  fontWeight: 600,
                }}
              >
                {extendedSyncing ? 'Syncing…' : 'Sync extended data'}
              </button>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Calculation Rules" subtitle="Shared formulas used across the dashboard">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: T.font.xs, color: T.textDim, lineHeight: 1.6 }}>
            <div><strong style={{ color: T.text }}>Net worth</strong>: assets minus liabilities using true debt balances.</div>
            <div><strong style={{ color: T.text }}>Cash on hand</strong>: checking, savings, and liquid cash accounts only.</div>
            <div><strong style={{ color: T.text }}>Monthly cash flow</strong>: last {cashflowPeriodDays} days, with transfers excluded.</div>
            <div><strong style={{ color: T.text }}>Recurring obligations</strong>: validated monthly recurring outflows only.</div>
            <div><strong style={{ color: T.text }}>Recurring income</strong>: validated monthly recurring inflows only.</div>
            <div style={{ paddingTop: '0.4rem', color: T.muted }}>
              Current net worth: {financeModel?.summary ? fmtSignedUSD(financeModel.summary.netWorth) : '—'}
            </div>
          </div>
        </PanelCard>
      </div>
    </PageScaffold>
  );
}
