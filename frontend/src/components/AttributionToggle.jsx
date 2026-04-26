import React from 'react';
import { FINANCE_T as T } from '../theme/financeTheme';

export default function AttributionToggle({ value, onChange }) {
  const modes = [
    { id: 'grouped', label: 'Grouped' },
    { id: 'flat', label: 'Flat' },
  ];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.2rem', borderRadius: 99,
      border: `1px solid ${T.border}`,
      background: 'rgba(255,255,255,0.02)',
    }}>
      <span style={{
        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: T.muted, paddingLeft: '0.45rem', paddingRight: '0.15rem',
      }}>
        Attribution
      </span>
      {modes.map(m => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            style={{
              border: `1px solid ${active ? T.accentBord : 'transparent'}`,
              background: active ? T.accentBg : 'transparent',
              color: active ? T.accent : T.muted,
              borderRadius: 99,
              padding: '0.2rem 0.65rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              fontFamily: T.sans,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
