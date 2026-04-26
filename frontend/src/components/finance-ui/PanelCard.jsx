import React from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';

// Reusable panel container. Use `flush` to hide padding when the panel owns
// its own scroll region (e.g. data tables in DataViewport).
export default function PanelCard({
  title,
  subtitle,
  actions,
  footer,
  children,
  flush = false,
  fill = false,
  padding,
}) {
  return (
    <section style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius.lg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: fill ? '100%' : undefined,
      minHeight: fill ? 0 : undefined,
    }}>
      {(title || actions) && (
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.8rem 1rem',
          borderBottom: `1px solid ${T.borderSoft}`,
        }}>
          <div style={{ minWidth: 0 }}>
            {title && (
              <div style={{
                fontSize: T.font.micro, fontWeight: 700, color: T.muted,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: T.font.xs, color: T.mutedDeep, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions && <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
        </header>
      )}
      <div style={{
        padding: flush ? 0 : (padding || '0.95rem 1rem'),
        flex: fill ? 1 : undefined,
        minHeight: 0,
        display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
      {footer && (
        <footer style={{
          padding: '0.65rem 1.1rem',
          borderTop: `1px solid ${T.borderSoft}`,
          fontSize: T.font.xs, color: T.muted,
        }}>
          {footer}
        </footer>
      )}
    </section>
  );
}
