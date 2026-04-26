import React from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';

// Fixed-height data region with internal scroll so long transaction lists,
// debt ledgers, or holdings tables don't turn the page into a giant feed.
// Accepts optional `stickyHeader` slot that remains pinned while the body
// scrolls.
export default function DataViewport({
  stickyHeader,
  height = 'min(64vh, 620px)',
  minHeight = 260,
  children,
  emptyState,
  isEmpty = false,
  flush = false,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height, minHeight,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius.lg,
      overflow: 'hidden',
    }}>
      {stickyHeader && (
        <div style={{
          borderBottom: `1px solid ${T.borderSoft}`,
          background: 'rgba(13,20,36,0.85)',
          backdropFilter: 'blur(6px)',
          padding: flush ? 0 : '0.65rem 1.1rem',
          flexShrink: 0,
        }}>
          {stickyHeader}
        </div>
      )}
      <div className="fin-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {isEmpty && emptyState ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', padding: '2rem',
            fontSize: T.font.sm, color: T.muted, textAlign: 'center',
          }}>
            {emptyState}
          </div>
        ) : children}
      </div>
    </div>
  );
}
