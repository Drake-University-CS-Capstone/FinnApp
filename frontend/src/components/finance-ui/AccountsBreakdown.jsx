import React, { useMemo } from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';
import { ACCOUNT_CLASS, classifyAccount, groupAccounts } from '../../finance/accountClass';
import { fmtUSD } from './fmt';

// Compact per-account row. The tone (cash/debt/investment) drives the
// semantic pill and value color so the user can distinguish asset types at
// a glance without reading every label.
function AccountRow({ acct, compact }) {
  const klass = acct.account_class || classifyAccount(acct);
  const isDebt = klass === ACCOUNT_CLASS.DEBT;
  const isInvestment = klass === ACCOUNT_CLASS.INVESTMENT;
  const tint = isDebt ? T.red : isInvestment ? T.accent : T.green;
  const tintBg = isDebt ? T.redBg : isInvestment ? T.accentBg : T.greenBg;
  const current = Number(acct.balances?.current) || 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: '0.75rem',
      padding: compact ? '0.55rem 0' : '0.7rem 0',
      borderBottom: `1px solid ${T.borderSoft}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: T.font.sm, color: T.text, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {acct.name || acct.official_name || 'Account'}
          {acct.mask && <span style={{ color: T.mutedDeep, marginLeft: 6, fontWeight: 400 }}>· {acct.mask}</span>}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          fontSize: '0.7rem', color: T.muted, marginTop: 2,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: tint, background: tintBg, border: `1px solid ${tintBg}`,
            borderRadius: T.radius.pill, padding: '1px 0.5rem',
            fontWeight: 600, letterSpacing: '0.03em', textTransform: 'capitalize',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: tint }} />
            {acct.subtype || acct.type || klass}
          </span>
          {acct.institution_name && <span>{acct.institution_name}</span>}
        </div>
      </div>
      <div style={{
        fontFamily: T.display,
        fontSize: compact ? '0.98rem' : '1.1rem',
        fontWeight: 600,
        color: isDebt ? T.red : T.text,
        whiteSpace: 'nowrap',
      }}>
        {isDebt && current > 0 ? '-' : ''}{fmtUSD(current)}
      </div>
    </div>
  );
}

function Section({ label, total, accounts, tone, compact }) {
  if (!accounts?.length) return null;
  const color = tone === 'neg' ? T.red : tone === 'pos' ? T.green : tone === 'invest' ? T.accent : T.text;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '0.25rem 0 0.35rem',
      }}>
        <span style={{
          fontSize: T.font.micro, fontWeight: 700, color: T.muted,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {label}
          <span style={{ marginLeft: 6, fontWeight: 500, color: T.mutedDeep }}>
            ({accounts.length})
          </span>
        </span>
        <span style={{
          fontSize: T.font.sm, fontWeight: 700, fontFamily: T.display, color,
        }}>
          {tone === 'neg' ? '-' : ''}{fmtUSD(total)}
        </span>
      </div>
      {accounts.map(a => <AccountRow key={a.account_id || a._id} acct={a} compact={compact} />)}
    </div>
  );
}

// Compact accounts breakdown used on Hub and Net Worth. Cash / Debt /
// Investment are clearly separated and the page never re-renders the old
// verbose card-per-account grid.
export default function AccountsBreakdown({ accounts, compact = false, showOther = true }) {
  const grouped = useMemo(() => groupAccounts(accounts || []), [accounts]);
  const sum = (list) => (list || []).reduce((s, a) => s + (Number(a.balances?.current) || 0), 0);

  const hasAny = Object.values(grouped).some(arr => arr.length > 0);
  if (!hasAny) {
    return (
      <div style={{ fontSize: T.font.sm, color: T.muted, padding: '1rem 0' }}>
        No accounts yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.6rem' : '1rem' }}>
      <Section
        label="Cash"
        accounts={grouped[ACCOUNT_CLASS.CASH]}
        total={sum(grouped[ACCOUNT_CLASS.CASH])}
        tone="pos"
        compact={compact}
      />
      <Section
        label="Investments"
        accounts={grouped[ACCOUNT_CLASS.INVESTMENT]}
        total={sum(grouped[ACCOUNT_CLASS.INVESTMENT])}
        tone="invest"
        compact={compact}
      />
      <Section
        label="Debt & liabilities"
        accounts={grouped[ACCOUNT_CLASS.DEBT]}
        total={sum(grouped[ACCOUNT_CLASS.DEBT])}
        tone="neg"
        compact={compact}
      />
      {showOther && (
        <Section
          label="Other"
          accounts={grouped[ACCOUNT_CLASS.OTHER]}
          total={sum(grouped[ACCOUNT_CLASS.OTHER])}
          compact={compact}
        />
      )}
    </div>
  );
}
