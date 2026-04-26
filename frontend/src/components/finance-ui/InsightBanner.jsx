import React from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';

const TONE_MAP = {
  positive: {
    border: 'rgba(134,239,172,0.32)',
    background: 'rgba(134,239,172,0.09)',
    accent: T.green,
  },
  negative: {
    border: 'rgba(252,165,165,0.32)',
    background: 'rgba(252,165,165,0.08)',
    accent: T.red,
  },
  warn: {
    border: 'rgba(253,230,138,0.32)',
    background: 'rgba(253,230,138,0.08)',
    accent: T.yellow,
  },
  accent: {
    border: T.accentBord,
    background: T.accentBg,
    accent: T.accent,
  },
};

export default function InsightBanner({ title, body, tone = 'accent' }) {
  const colors = TONE_MAP[tone] || TONE_MAP.accent;

  return (
    <section style={{
      border: `1px solid ${colors.border}`,
      background: colors.background,
      borderRadius: T.radius.lg,
      padding: '0.95rem 1.1rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.85rem',
    }}>
      <span style={{
        width: 10,
        height: 10,
        borderRadius: 99,
        background: colors.accent,
        marginTop: 6,
        flexShrink: 0,
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: T.font.sm, color: T.text, fontWeight: 600 }}>
          {title}
        </div>
        {body && (
          <div style={{ fontSize: T.font.xs, color: T.textDim, marginTop: 4, lineHeight: 1.55 }}>
            {body}
          </div>
        )}
      </div>
    </section>
  );
}
