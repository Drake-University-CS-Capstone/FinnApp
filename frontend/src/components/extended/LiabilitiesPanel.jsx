import React, { useMemo, useState } from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';
import {
  DataViewport,
  SegmentedTabs,
  StatCard,
  StatGrid,
  fmtUSD,
  fmtPct,
} from '../finance-ui';

// ── Card templates for each debt type ──────────────────────────────────────
function UtilBar({ balance, limit }) {
  if (!limit) return null;
  const pct = Math.min(100, (balance / limit) * 100);
  const color = pct > 60 ? T.red : pct > 30 ? T.yellow : T.green;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.7rem', color: T.muted }}>Utilization</span>
        <span style={{ fontSize: '0.7rem', color, fontWeight: 600 }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 4, background: T.borderSoft, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: 99, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
    </div>
  );
}

function CardShell({ eyebrow, title, headline, headlineSub, children }) {
  return (
    <div style={{
      padding: '1rem 1.1rem',
      borderBottom: `1px solid ${T.borderSoft}`,
      display: 'flex', flexDirection: 'column', gap: '0.6rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: T.font.micro, fontWeight: 700, color: T.muted,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {eyebrow}
          </div>
          {title && (
            <div style={{ fontSize: T.font.sm, color: T.text, fontWeight: 600, marginTop: 2 }}>
              {title}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: T.display, fontSize: '1.35rem', color: T.red, lineHeight: 1 }}>
            {headline}
          </div>
          {headlineSub && (
            <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 2 }}>{headlineSub}</div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function Fields({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.45rem 1rem' }}>
      {rows.map(f => (
        <div key={f.label}>
          <div style={{ fontSize: '0.64rem', color: T.mutedDeep, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {f.label}
          </div>
          <div style={{ fontSize: T.font.xs, color: T.text, fontWeight: 500, marginTop: 1 }}>{f.value}</div>
        </div>
      ))}
    </div>
  );
}

function CreditCard({ cc }) {
  return (
    <CardShell
      eyebrow="Credit card"
      title={cc.name || cc.official_name}
      headline={fmtUSD(cc.balance_current)}
      headlineSub={cc.credit_limit != null ? `of ${fmtUSD(cc.credit_limit)} limit` : undefined}
    >
      <UtilBar balance={cc.balance_current} limit={cc.credit_limit} />
      <Fields rows={[
        { label: 'Min payment',  value: fmtUSD(cc.minimum_payment_amount) },
        { label: 'Due date',     value: cc.next_payment_due_date || '—' },
        { label: 'APR',          value: fmtPct(cc.purchase_apr) },
        { label: 'Last payment', value: fmtUSD(cc.last_payment_amount) },
      ]} />
      {cc.is_overdue && (
        <div style={{ fontSize: T.font.xs, color: T.red, background: T.redBg, padding: '0.3rem 0.6rem', borderRadius: 6 }}>
          Payment overdue
        </div>
      )}
    </CardShell>
  );
}

function StudentLoan({ sl }) {
  return (
    <CardShell
      eyebrow={`Student loan${sl.loan_name ? ` · ${sl.loan_name}` : ''}`}
      headline={fmtUSD(sl.outstanding_interest_amount)}
      headlineSub="outstanding interest"
    >
      <Fields rows={[
        { label: 'Interest rate',   value: fmtPct(sl.interest_rate_percentage) },
        { label: 'Min payment',     value: fmtUSD(sl.minimum_payment_amount) },
        { label: 'Repayment plan',  value: sl.repayment_plan_type || '—' },
        { label: 'Expected payoff', value: sl.expected_payoff_date || '—' },
        { label: 'Status',          value: sl.loan_status || '—' },
        { label: 'Due date',        value: sl.next_payment_due_date || '—' },
      ]} />
    </CardShell>
  );
}

function Mortgage({ mtg }) {
  return (
    <CardShell
      eyebrow={`Mortgage${mtg.loan_type_description ? ` · ${mtg.loan_type_description}` : ''}`}
      headline={fmtUSD(mtg.outstanding_principal_balance)}
      headlineSub="outstanding principal"
    >
      <Fields rows={[
        { label: 'Rate',            value: `${fmtPct(mtg.interest_rate_percentage)} ${mtg.interest_rate_type || ''}`.trim() },
        { label: 'Monthly payment', value: fmtUSD(mtg.next_monthly_payment) },
        { label: 'Escrow balance',  value: fmtUSD(mtg.escrow_balance) },
        { label: 'Maturity date',   value: mtg.maturity_date || '—' },
        { label: 'PMI',             value: mtg.has_pmi ? 'Yes' : mtg.has_pmi === false ? 'No' : '—' },
        { label: 'Next payment',    value: mtg.next_payment_due_date || '—' },
      ]} />
    </CardShell>
  );
}

function DebtAccount({ acct }) {
  return (
    <CardShell
      eyebrow={acct.subtype ? acct.subtype.replace(/_/g, ' ') : 'Debt account'}
      title={`${acct.name || acct.official_name || 'Account'}${acct.institution_name ? ` · ${acct.institution_name}` : ''}`}
      headline={fmtUSD(acct.current_balance)}
    >
      <Fields rows={[
        { label: 'Type',         value: acct.type || '—' },
        { label: 'Subtype',      value: acct.subtype || '—' },
        { label: 'Credit limit', value: fmtUSD(acct.credit_limit) },
        { label: 'Available',    value: fmtUSD(acct.available_balance) },
      ]} />
    </CardShell>
  );
}

export default function LiabilitiesPanel({ data, loading }) {
  const [tab, setTab] = useState('credit');

  if (loading) {
    return <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>Loading liabilities…</div>;
  }
  if (!data) {
    return <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>No liabilities data yet. Sync extended data first.</div>;
  }

  const { credit_cards = [], student_loans = [], mortgages = [], debt_accounts = [], summary = {} } = data;
  const util = summary.credit_utilization_pct;

  const tabs = useMemo(() => ([
    { id: 'credit',    label: 'Credit',        count: credit_cards.length },
    { id: 'student',   label: 'Student loans', count: student_loans.length },
    { id: 'mortgage',  label: 'Mortgages',     count: mortgages.length },
    { id: 'other_debt', label: 'Other debt',    count: debt_accounts.length },
  ].filter(t => t.count > 0)), [credit_cards.length, student_loans.length, mortgages.length, debt_accounts.length]);

  if (tabs.length === 0) {
    return <div style={{ color: T.muted, fontSize: T.font.sm, padding: '2rem 0', textAlign: 'center' }}>No liabilities found for this item.</div>;
  }
  const activeTab = tabs.find(t => t.id === tab) ? tab : tabs[0].id;

  const rows =
    activeTab === 'credit'     ? credit_cards.map((cc, i) => <CreditCard key={cc.account_id || i} cc={cc} />) :
    activeTab === 'student'    ? student_loans.map((sl, i) => <StudentLoan key={sl.account_id || i} sl={sl} />) :
    activeTab === 'mortgage'   ? mortgages.map((m, i) => <Mortgage key={m.account_id || i} mtg={m} />) :
    activeTab === 'other_debt' ? debt_accounts.map((a, i) => <DebtAccount key={a.plaid_account_id || i} acct={a} />) :
    null;

  return (
    <div style={{ fontFamily: T.sans, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <StatGrid min={170}>
        {credit_cards.length > 0 && (
          <StatCard
            label="Credit balance"
            value={fmtUSD(summary.total_credit_balance)}
            tone="negative"
            sub={util != null ? `${util}% utilization` : 'No limit data'}
          />
        )}
        {student_loans.length > 0 && (
          <StatCard
            label="Student loans"
            value={`${student_loans.length} loan${student_loans.length !== 1 ? 's' : ''}`}
            emphasis="secondary"
          />
        )}
        {mortgages.length > 0 && (
          <StatCard
            label="Mortgages"
            value={`${mortgages.length}`}
            emphasis="secondary"
          />
        )}
        {debt_accounts.length > 0 && (
          <StatCard
            label="Other debt accounts"
            value={`${debt_accounts.length}`}
            emphasis="secondary"
          />
        )}
      </StatGrid>

      <SegmentedTabs tabs={tabs} value={activeTab} onChange={setTab} />

      <DataViewport height="min(62vh, 640px)" isEmpty={!rows || rows.length === 0} emptyState="No records in this category.">
        {rows}
      </DataViewport>
    </div>
  );
}
