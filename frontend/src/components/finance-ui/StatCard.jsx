import React from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';

// A single KPI tile with consistent size, alignment, and hierarchy so every
// page reads the same way. `tone` switches the accent/semantic color.
export default function StatCard({
  label,
  value,
  sub,
  tone = 'neutral',
  accent,
  onClick,
  emphasis = 'primary', // "primary" = hero metric, "secondary" = smaller tile
}) {
  const toneColor = {
    neutral:  T.text,
    positive: T.green,
    negative: T.red,
    warn:     T.yellow,
    accent:   T.accent,
  }[tone] || T.text;

  const interactive = typeof onClick === 'function';
  const valueSize = emphasis === 'primary' ? '1.7rem' : '1.35rem';

  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        padding: emphasis === 'primary' ? '1rem 1.1rem' : '0.85rem 0.95rem',
        borderRadius: T.radius.lg,
        background: T.surface,
        border: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color 0.15s, transform 0.12s, background 0.15s',
      }}
      onMouseEnter={e => {
        if (!interactive) return;
        e.currentTarget.style.borderColor = T.borderHov;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        if (!interactive) return;
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        fontSize: T.font.micro, fontWeight: 600, color: T.muted,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: T.display,
        fontSize: valueSize,
        color: accent || toneColor,
        letterSpacing: '-0.01em',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: T.font.xs, color: T.muted, lineHeight: 1.45 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
