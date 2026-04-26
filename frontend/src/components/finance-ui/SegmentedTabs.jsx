import React from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';

// Segmented pill-style tab control used for "Grouped/Flat", "Bills/Income",
// "Holdings/Activity", etc. Keeps visuals identical everywhere.
export default function SegmentedTabs({
  tabs,
  value,
  onChange,
  size = 'md',
  label,
}) {
  const pad = size === 'sm' ? '0.2rem 0.65rem' : '0.3rem 0.8rem';
  const font = size === 'sm' ? '0.72rem' : '0.75rem';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem', borderRadius: T.radius.pill,
      border: `1px solid ${T.border}`,
      background: 'rgba(255,255,255,0.02)',
    }}>
      {label && (
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: T.muted,
          padding: '0 0.4rem 0 0.55rem',
        }}>{label}</span>
      )}
      {tabs.map(t => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            disabled={t.disabled}
            style={{
              border: `1px solid ${active ? T.accentBord : 'transparent'}`,
              background: active ? T.accentBg : 'transparent',
              color: active ? T.accent : (t.disabled ? T.mutedDeep : T.muted),
              borderRadius: T.radius.pill,
              padding: pad,
              fontSize: font,
              fontWeight: 600,
              fontFamily: T.sans,
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              opacity: t.disabled ? 0.5 : 1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.count != null && (
              <span style={{
                marginLeft: 6,
                fontSize: '0.68rem',
                color: active ? T.accentStrong : T.mutedDeep,
                fontWeight: 500,
              }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
