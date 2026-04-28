import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FINANCE_T as T, normalizeCategoryLabel } from '../theme/financeTheme';
import { useFinanceSession } from '../finance/FinanceSessionContext';
import { ACCOUNT_CLASS, classifyAccount } from '../finance/accountClass';
import {
  DataViewport,
  PageScaffold,
  PanelCard,
  SegmentedTabs,
  fmtDate,
  fmtPct,
  fmtShortDate,
  fmtUSD,
} from '../components/finance-ui';

function humanize(value) {
  if (!value) return '—';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMask(mask) {
  return mask ? `•••• ${mask}` : '—';
}

function formatAccountBalance(account, tone, amount = account?.balances?.current) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const numeric = Number(amount);
  const showNegative = tone === 'negative' && numeric > 0;
  return `${showNegative ? '-' : ''}${fmtUSD(numeric)}`;
}

function formatTransactionAmount(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const numeric = Number(amount);
  return `${numeric > 0 ? '-' : '+'}${fmtUSD(numeric)}`;
}

function transactionLabel(tx) {
  if (tx?.category_detailed) return humanize(tx.category_detailed);
  if (tx?.category_raw) return normalizeCategoryLabel(tx.category_raw);
  if (tx?.category) return normalizeCategoryLabel(tx.category);
  if (tx?.payment_channel) return humanize(tx.payment_channel);
  return 'Transaction';
}

function compactSecurityType(value) {
  if (!value) return 'Holding';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function investmentActivityLabel(tx) {
  const type = tx?.type ? humanize(tx.type) : 'Activity';
  const ticker = tx?.ticker_symbol ? ` ${tx.ticker_symbol}` : '';
  return `${type}${ticker}`;
}

function AccountRow({ account, tone, selected, onSelect }) {
  const color = tone === 'negative' ? T.red : tone === 'accent' ? T.accent : T.green;
  const display = formatAccountBalance(account, tone);

  return (
    <button
      type="button"
      onClick={() => onSelect(account.account_id)}
      aria-pressed={selected}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '0.85rem',
        alignItems: 'center',
        padding: '0.9rem 1rem',
        border: 'none',
        borderBottom: `1px solid ${T.borderSoft}`,
        background: selected ? T.accentBg : 'transparent',
        boxShadow: selected ? `inset 2px 0 0 ${T.accent}` : 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = T.surfaceHov;
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <div style={{ fontSize: T.font.sm, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {account.name || account.official_name || 'Account'}
          </div>
          <div style={{ fontSize: T.font.xs, color: T.mutedDeep, whiteSpace: 'nowrap' }}>
            {formatMask(account.mask)}
          </div>
        </div>
        <div style={{ fontSize: T.font.xs, color: T.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {account.institution_name || 'Linked account'} · {humanize(account.subtype || account.type || 'Account')}
        </div>
      </div>
      <div style={{ fontSize: T.font.sm, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
        {display}
      </div>
    </button>
  );
}

function AccountGroupSection({ group, selectedAccountId, onSelect }) {
  return (
    <div>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.8rem 1rem',
        background: 'rgba(13,20,36,0.92)',
        borderBottom: `1px solid ${T.borderSoft}`,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontSize: T.font.micro, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, fontWeight: 700 }}>
          {group.label}
          <span style={{ color: T.mutedDeep, marginLeft: 6 }}>({group.accounts.length})</span>
        </div>
      </div>
      {group.accounts.map((account) => (
        <AccountRow
          key={account.account_id}
          account={account}
          tone={group.tone}
          selected={String(selectedAccountId) === String(account.account_id)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
      <div style={{ fontSize: T.font.micro, color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: T.font.sm, color: T.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, bordered = true }) {
  return (
    <div style={{
      borderTop: bordered ? `1px solid ${T.borderSoft}` : 'none',
      paddingTop: bordered ? '1rem' : 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
    }}>
      <div>
        <div style={{ fontSize: T.font.micro, color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ marginTop: 4, fontSize: T.font.xs, color: T.muted }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default function FinanceAccounts() {
  const {
    phase,
    selectedItem,
    financeModel,
    transactions,
    liabilitiesData,
    investmentsHoldings,
    investmentsTx,
  } = useFinanceSession();
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');

  if (phase !== 'dashboard' || !selectedItem) {
    return <Navigate to="/home" replace />;
  }

  const accountGroups = financeModel?.accountGroups || [];
  const orderedAccounts = useMemo(
    () => accountGroups.flatMap((group) => group.accounts.map((account) => ({
      ...account,
      group_label: group.label,
      group_tone: group.tone,
    }))),
    [accountGroups],
  );

  useEffect(() => {
    if (!orderedAccounts.length) {
      setSelectedAccountId(null);
      return;
    }
    if (!orderedAccounts.some((account) => String(account.account_id) === String(selectedAccountId))) {
      setSelectedAccountId(String(orderedAccounts[0].account_id));
    }
  }, [orderedAccounts, selectedAccountId]);

  const selectedAccount = useMemo(
    () => orderedAccounts.find((account) => String(account.account_id) === String(selectedAccountId)) || null,
    [orderedAccounts, selectedAccountId],
  );

  const recentActivity = useMemo(() => {
    if (!selectedAccount) return [];
    return [...(transactions || [])]
      .filter((tx) => String(tx.account_id) === String(selectedAccount.account_id))
      .sort((a, b) => {
        const dateCompare = String(b?.date || '').localeCompare(String(a?.date || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b?.transaction_id || '').localeCompare(String(a?.transaction_id || ''));
      })
      .slice(0, 6);
  }, [transactions, selectedAccount]);

  const selectedAccountSummary = selectedAccount ? [
    { label: 'Institution', value: selectedAccount.institution_name || '—' },
    { label: 'Account Type', value: humanize(selectedAccount.type) },
    { label: 'Subtype', value: humanize(selectedAccount.subtype) },
    { label: 'Last 4', value: selectedAccount.mask ? String(selectedAccount.mask) : '—' },
    { label: 'Current Balance', value: formatAccountBalance(selectedAccount, selectedAccount.group_tone) },
    { label: 'Available Balance', value: selectedAccount?.balances?.available == null ? '—' : fmtUSD(selectedAccount.balances.available) },
    { label: 'Status', value: selectedAccount.is_active == null ? '—' : selectedAccount.is_active ? 'Active' : 'Inactive' },
    { label: 'Ownership Type', value: humanize(selectedAccount.holder_category) },
    { label: 'Currency', value: selectedAccount?.balances?.iso_currency_code || selectedAccount?.balances?.unofficial_currency_code || '—' },
    { label: 'Last Synced', value: fmtDate(selectedAccount.updated_at) },
    { label: 'Linked Date', value: fmtDate(selectedAccount.created_at) },
    { label: 'Internal Account ID', value: selectedAccount.account_id || '—' },
  ] : [];

  const selectedAccountClass = selectedAccount ? classifyAccount(selectedAccount) : ACCOUNT_CLASS.OTHER;
  const selectedPlaidAccountId = selectedAccount?.plaid_account_id ? String(selectedAccount.plaid_account_id) : null;

  const allSelectedInvestmentHoldings = useMemo(() => {
    if (!selectedPlaidAccountId) return [];
    return [...(investmentsHoldings?.holdings || [])]
      .filter((holding) => String(holding.account_id) === selectedPlaidAccountId)
      .sort((a, b) => Number(b?.institution_value || 0) - Number(a?.institution_value || 0));
  }, [investmentsHoldings, selectedPlaidAccountId]);

  const selectedInvestmentHoldings = useMemo(
    () => allSelectedInvestmentHoldings.slice(0, 6),
    [allSelectedInvestmentHoldings],
  );

  const allSelectedInvestmentActivity = useMemo(() => {
    if (!selectedPlaidAccountId) return [];
    return [...(investmentsTx?.investment_transactions || [])]
      .filter((tx) => String(tx.account_id) === selectedPlaidAccountId)
      .sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
  }, [investmentsTx, selectedPlaidAccountId]);

  const selectedInvestmentActivity = useMemo(
    () => allSelectedInvestmentActivity.slice(0, 6),
    [allSelectedInvestmentActivity],
  );

  const selectedCreditCard = useMemo(
    () => (liabilitiesData?.credit_cards || []).find((item) => String(item.account_id) === selectedPlaidAccountId) || null,
    [liabilitiesData, selectedPlaidAccountId],
  );
  const selectedStudentLoan = useMemo(
    () => (liabilitiesData?.student_loans || []).find((item) => String(item.account_id) === selectedPlaidAccountId) || null,
    [liabilitiesData, selectedPlaidAccountId],
  );
  const selectedMortgage = useMemo(
    () => (liabilitiesData?.mortgages || []).find((item) => String(item.account_id) === selectedPlaidAccountId) || null,
    [liabilitiesData, selectedPlaidAccountId],
  );
  const selectedOtherDebt = useMemo(
    () => (liabilitiesData?.debt_accounts || []).find((item) => String(item.plaid_account_id) === selectedPlaidAccountId) || null,
    [liabilitiesData, selectedPlaidAccountId],
  );

  const debtDetailFields = useMemo(() => {
    if (selectedCreditCard) {
      return {
        title: 'Credit Details',
        subtitle: 'APR, payment timing, and utilization details from synced liabilities data',
        rows: [
          { label: 'APR', value: fmtPct(selectedCreditCard.purchase_apr) },
          { label: 'Minimum Payment', value: fmtUSD(selectedCreditCard.minimum_payment_amount) },
          { label: 'Due Date', value: selectedCreditCard.next_payment_due_date || '—' },
          { label: 'Last Payment', value: fmtUSD(selectedCreditCard.last_payment_amount) },
          { label: 'Credit Limit', value: fmtUSD(selectedCreditCard.credit_limit) },
          { label: 'Overdue', value: selectedCreditCard.is_overdue == null ? '—' : selectedCreditCard.is_overdue ? 'Yes' : 'No' },
        ],
      };
    }
    if (selectedStudentLoan) {
      return {
        title: 'Loan Terms',
        subtitle: 'Student loan terms and repayment details from synced liabilities data',
        rows: [
          { label: 'Interest Rate', value: fmtPct(selectedStudentLoan.interest_rate_percentage) },
          { label: 'Minimum Payment', value: fmtUSD(selectedStudentLoan.minimum_payment_amount) },
          { label: 'Due Date', value: selectedStudentLoan.next_payment_due_date || '—' },
          { label: 'Repayment Plan', value: humanize(selectedStudentLoan.repayment_plan_type) },
          { label: 'Expected Payoff', value: selectedStudentLoan.expected_payoff_date || '—' },
          { label: 'Status', value: humanize(selectedStudentLoan.loan_status) },
        ],
      };
    }
    if (selectedMortgage) {
      return {
        title: 'Mortgage Terms',
        subtitle: 'Rate, next payment, and maturity details from synced liabilities data',
        rows: [
          { label: 'Interest Rate', value: fmtPct(selectedMortgage.interest_rate_percentage) },
          { label: 'Rate Type', value: humanize(selectedMortgage.interest_rate_type) },
          { label: 'Next Payment', value: fmtUSD(selectedMortgage.next_monthly_payment) },
          { label: 'Due Date', value: selectedMortgage.next_payment_due_date || '—' },
          { label: 'Maturity Date', value: selectedMortgage.maturity_date || '—' },
          { label: 'PMI', value: selectedMortgage.has_pmi == null ? '—' : selectedMortgage.has_pmi ? 'Yes' : 'No' },
        ],
      };
    }
    if (selectedOtherDebt) {
      return {
        title: 'Debt Details',
        subtitle: 'The best available metadata for this debt account',
        rows: [
          { label: 'Current Balance', value: fmtUSD(selectedOtherDebt.current_balance) },
          { label: 'Available Balance', value: fmtUSD(selectedOtherDebt.available_balance) },
          { label: 'Credit Limit', value: fmtUSD(selectedOtherDebt.credit_limit) },
          { label: 'Currency', value: selectedOtherDebt.iso_currency_code || '—' },
        ],
      };
    }
    return null;
  }, [selectedCreditCard, selectedStudentLoan, selectedMortgage, selectedOtherDebt]);

  const detailTabs = useMemo(() => {
    const tabs = [{ id: 'overview', label: 'Overview' }];
    if (selectedAccountClass === ACCOUNT_CLASS.INVESTMENT) {
      tabs.push(
        { id: 'holdings', label: 'Holdings', count: allSelectedInvestmentHoldings.length },
        { id: 'investment-activity', label: 'Investment Activity', count: allSelectedInvestmentActivity.length },
      );
    }
    if (selectedAccountClass === ACCOUNT_CLASS.DEBT) {
      tabs.push({ id: 'terms', label: 'Terms' });
    }
    tabs.push({ id: 'transactions', label: 'Transactions', count: recentActivity.length });
    return tabs;
  }, [
    allSelectedInvestmentActivity.length,
    allSelectedInvestmentHoldings.length,
    recentActivity.length,
    selectedAccountClass,
  ]);

  useEffect(() => {
    setDetailTab('overview');
  }, [selectedAccountId]);

  useEffect(() => {
    if (!detailTabs.some((tab) => tab.id === detailTab)) {
      setDetailTab(detailTabs[0]?.id || 'overview');
    }
  }, [detailTab, detailTabs]);

  return (
    <PageScaffold
      eyebrow="Accounts"
      title="Accounts"
      description="Select an account to inspect its metadata, balances, and recent activity without leaving the page."
      showSync={false}
      showSwitchBank={false}
    >
      <div className="fin-account-master-detail" style={{ marginTop: '1rem' }}>
        <DataViewport
          height="min(76vh, 860px)"
          minHeight={420}
          isEmpty={accountGroups.length === 0}
          emptyState="No linked accounts yet."
          stickyHeader={(
            <div>
              <div style={{ fontSize: T.font.micro, color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                Accounts
              </div>
              <div style={{ marginTop: 4, fontSize: T.font.sm, color: T.textDim, fontWeight: 600 }}>
                Browse your grouped accounts
              </div>
              <div style={{ marginTop: 2, fontSize: T.font.xs, color: T.muted }}>
                Click an account to view details and recent activity
              </div>
            </div>
          )}
        >
          {accountGroups.map((group) => (
            <AccountGroupSection
              key={group.id}
              group={group}
              selectedAccountId={selectedAccountId}
              onSelect={setSelectedAccountId}
            />
          ))}
        </DataViewport>

        <PanelCard
          title="Selected Account"
          subtitle={selectedAccount ? 'Metadata and recent activity for the selected account' : 'Choose an account from the list'}
          fill
        >
          {!selectedAccount ? (
            <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: T.font.sm, textAlign: 'center' }}>
              No account selected.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                alignItems: 'flex-start',
                padding: '0.95rem 1rem',
                borderRadius: T.radius.lg,
                border: `1px solid ${T.borderSoft}`,
                background: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.display, fontSize: T.font.lg, color: T.text, lineHeight: 1.15 }}>
                    {selectedAccount.name || selectedAccount.official_name || 'Account'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: T.font.xs, color: T.muted }}>
                    {selectedAccount.official_name && selectedAccount.official_name !== selectedAccount.name
                      ? `${selectedAccount.official_name} · `
                      : ''}
                    {selectedAccount.institution_name || 'Linked account'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: T.font.micro, color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                    Current Balance
                  </div>
                  <div style={{ marginTop: 4, fontSize: T.font.lg, fontWeight: 700, color: selectedAccount.group_tone === 'negative' ? T.red : selectedAccount.group_tone === 'accent' ? T.accent : T.green }}>
                    {formatAccountBalance(selectedAccount, selectedAccount.group_tone)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <SegmentedTabs
                  tabs={detailTabs}
                  value={detailTab}
                  onChange={setDetailTab}
                  size="sm"
                />
              </div>

              {detailTab === 'overview' && (
                <SectionCard
                  title="Overview"
                  subtitle="Core account metadata and balances"
                  bordered={false}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem 1rem' }}>
                    {selectedAccountSummary.map((field) => (
                      <DetailField key={field.label} label={field.label} value={field.value} />
                    ))}
                  </div>
                </SectionCard>
              )}

              {detailTab === 'holdings' && (
                <SectionCard
                  title="Holdings"
                  subtitle="Synced positions inside this investment account"
                  bordered={false}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem 1rem' }}>
                    <DetailField label="Holdings" value={allSelectedInvestmentHoldings.length ? String(allSelectedInvestmentHoldings.length) : '—'} />
                    <DetailField
                      label="Market Value"
                      value={allSelectedInvestmentHoldings.length
                        ? fmtUSD(allSelectedInvestmentHoldings.reduce((sum, holding) => sum + Number(holding.institution_value || 0), 0))
                        : '—'}
                    />
                    <DetailField
                      label="Unrealized Gain"
                      value={allSelectedInvestmentHoldings.length
                        ? fmtUSD(allSelectedInvestmentHoldings.reduce((sum, holding) => sum + Number(holding.unrealized_gain || 0), 0))
                        : '—'}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {selectedInvestmentHoldings.length === 0 ? (
                      <div style={{
                        padding: '0.95rem 1rem',
                        borderRadius: T.radius.lg,
                        border: `1px dashed ${T.borderSoft}`,
                        color: T.muted,
                        fontSize: T.font.sm,
                      }}>
                        No synced holdings found for this investment account yet.
                      </div>
                    ) : selectedInvestmentHoldings.map((holding) => (
                      <div
                        key={`${holding.security_id}-${holding.account_id}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: '0.75rem',
                          alignItems: 'center',
                          padding: '0.8rem 0.9rem',
                          borderRadius: T.radius.md,
                          border: `1px solid ${T.borderSoft}`,
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: T.font.sm, color: T.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {holding.ticker_symbol || holding.name || 'Holding'}
                          </div>
                          <div style={{ marginTop: 3, fontSize: T.font.xs, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {holding.name && holding.ticker_symbol ? holding.name : compactSecurityType(holding.security_type)} · {holding.quantity != null ? `${holding.quantity} units` : 'Quantity unavailable'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: T.font.sm, fontWeight: 700, color: T.text }}>
                            {fmtUSD(holding.institution_value)}
                          </div>
                          <div style={{ marginTop: 3, fontSize: T.font.xs, color: holding.unrealized_gain == null ? T.muted : Number(holding.unrealized_gain) >= 0 ? T.green : T.red }}>
                            {holding.unrealized_gain == null
                              ? '—'
                              : `${Number(holding.unrealized_gain) >= 0 ? '+' : '-'}${fmtUSD(holding.unrealized_gain)}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {detailTab === 'investment-activity' && (
                <SectionCard
                  title="Investment Activity"
                  subtitle="Recent trades, dividends, and other synced investment events"
                  bordered={false}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {selectedInvestmentActivity.length === 0 ? (
                      <div style={{
                        padding: '0.95rem 1rem',
                        borderRadius: T.radius.lg,
                        border: `1px dashed ${T.borderSoft}`,
                        color: T.muted,
                        fontSize: T.font.sm,
                      }}>
                        No synced investment activity found for this account yet.
                      </div>
                    ) : selectedInvestmentActivity.map((tx) => (
                      <div
                        key={tx.investment_transaction_id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: '0.75rem',
                          alignItems: 'center',
                          padding: '0.8rem 0.9rem',
                          borderRadius: T.radius.md,
                          border: `1px solid ${T.borderSoft}`,
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: T.font.sm, color: T.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {investmentActivityLabel(tx)}
                          </div>
                          <div style={{ marginTop: 3, fontSize: T.font.xs, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tx.name || 'Security'} · {fmtShortDate(tx.date)}
                          </div>
                        </div>
                        <div style={{ fontSize: T.font.sm, fontWeight: 700, color: T.text, whiteSpace: 'nowrap' }}>
                          {fmtUSD(tx.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {detailTab === 'terms' && (
                <SectionCard
                  title={debtDetailFields?.title || 'Debt Details'}
                  subtitle={debtDetailFields?.subtitle || 'Additional loan and rate details appear here when synced liabilities data is available'}
                  bordered={false}
                >
                  {debtDetailFields ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem 1rem' }}>
                      {debtDetailFields.rows.map((field) => (
                        <DetailField key={field.label} label={field.label} value={field.value} />
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      padding: '0.95rem 1rem',
                      borderRadius: T.radius.lg,
                      border: `1px dashed ${T.borderSoft}`,
                      color: T.muted,
                      fontSize: T.font.sm,
                    }}>
                      No synced rate or payment metadata is available for this debt account yet.
                    </div>
                  )}
                </SectionCard>
              )}

              {detailTab === 'transactions' && (
                <SectionCard
                  title="Transactions"
                  subtitle="The 6 most recent banking transactions currently loaded for this account"
                  bordered={false}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {recentActivity.length === 0 ? (
                      <div style={{
                        padding: '0.95rem 1rem',
                        borderRadius: T.radius.lg,
                        border: `1px dashed ${T.borderSoft}`,
                        color: T.muted,
                        fontSize: T.font.sm,
                      }}>
                        No recent activity available for this account yet.
                      </div>
                    ) : recentActivity.map((tx) => (
                      <div
                        key={tx.transaction_id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: '0.75rem',
                          alignItems: 'center',
                          padding: '0.8rem 0.9rem',
                          borderRadius: T.radius.md,
                          border: `1px solid ${T.borderSoft}`,
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: T.font.sm, color: T.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tx.merchant_name || tx.name || 'Transaction'}
                          </div>
                          <div style={{ marginTop: 3, fontSize: T.font.xs, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {transactionLabel(tx)} · {fmtShortDate(tx.date)}
                          </div>
                        </div>
                        <div style={{ fontSize: T.font.sm, fontWeight: 700, color: Number(tx.amount) > 0 ? T.red : T.green, whiteSpace: 'nowrap' }}>
                          {formatTransactionAmount(tx.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </PanelCard>
      </div>
    </PageScaffold>
  );
}
