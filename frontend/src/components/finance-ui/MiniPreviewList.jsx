import React from 'react';
import { Link } from 'react-router-dom';
import { FINANCE_T as T } from '../../theme/financeTheme';

// Compact preview list used on Hub/Cashflow for summary cross-references.
// Items: { key, primary, secondary, amount, tone ("pos"|"neg"|"neutral") }
export default function MiniPreviewList({ items, emptyText, deepLinkTo, deepLinkLabel }) {
  if (!items || items.length === 0) {
    return (
      <div style={{
        fontSize: T.font.xs, color: T.muted, padding: '0.5rem 0',
      }}>
        {emptyText || 'Nothing to show yet.'}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map(it => {
        const color = it.tone === 'pos' ? T.green : it.tone === 'neg' ? T.red : T.text;
        return (
          <div key={it.key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.6rem', padding: '0.45rem 0',
            borderBottom: `1px solid ${T.borderSoft}`,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: T.font.sm, color: T.text, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {it.primary}
              </div>
              {it.secondary && (
                <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 1 }}>
                  {it.secondary}
                </div>
              )}
            </div>
            {it.amount != null && (
              <span style={{ fontSize: T.font.sm, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
                {it.amount}
              </span>
            )}
          </div>
        );
      })}
      {deepLinkTo && (
        <Link
          to={deepLinkTo}
          style={{
            marginTop: '0.6rem', alignSelf: 'flex-start',
            fontSize: T.font.xs, color: T.accent, fontWeight: 600,
            textDecoration: 'none', letterSpacing: '0.03em',
          }}
        >
          {deepLinkLabel || 'View all →'}
        </Link>
      )}
    </div>
  );
}
