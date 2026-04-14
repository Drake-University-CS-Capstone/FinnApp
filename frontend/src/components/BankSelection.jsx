import React, { useState } from 'react';

const T = {
  bg:         '#0d1424',
  surface:    'rgba(255,255,255,0.03)',
  surfaceHov: 'rgba(99,102,241,0.08)',
  border:     'rgba(99,102,241,0.2)',
  borderHov:  'rgba(99,102,241,0.4)',
  text:       '#e2e8f0',
  muted:      '#94a3b8',
  accent:     '#a5b4fc',
  accentBg:   'rgba(99,102,241,0.15)',
  accentBord: 'rgba(99,102,241,0.4)',
  sans:       "'DM Sans', system-ui, sans-serif",
  display:    "'Playfair Display', Georgia, serif",
};

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@700&display=swap';

export default function BankSelection({ plaidItems, onSelect, onSelectAll, onAddNew }) {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div style={{
      fontFamily: T.sans, color: T.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', padding: '2rem',
    }}>
      <link rel="stylesheet" href={FONT_LINK} />

      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '14px', margin: '0 auto 1rem',
            background: T.accentBg, border: `1px solid ${T.accentBord}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"
                stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 style={{
            margin: 0, fontFamily: T.display, fontSize: '1.5rem',
            color: T.text, letterSpacing: '-0.01em',
          }}>
            Select a Bank
          </h2>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: T.muted, lineHeight: 1.5 }}>
            Choose one bank, or view combined data from every linked institution.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {onSelectAll && plaidItems.length > 0 && (
            <button
              type="button"
              onClick={onSelectAll}
              onMouseEnter={() => setHoveredId('__ALL__')}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                width: '100%', padding: '1rem 1.25rem',
                background: hoveredId === '__ALL__' ? 'rgba(99,102,241,0.12)' : T.surface,
                border: `1px solid ${hoveredId === '__ALL__' ? T.borderHov : T.accentBord}`,
                borderRadius: '12px', cursor: 'pointer',
                fontFamily: T.sans, textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                background: T.accentBg, border: `1px solid ${T.accentBord}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 12h16M4 18h10" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: T.text }}>
                  All connected banks
                </div>
                <div style={{ fontSize: '0.75rem', color: T.muted, marginTop: '0.15rem' }}>
                  Accounts and transactions from every link ({plaidItems.length} institution{plaidItems.length !== 1 ? 's' : ''})
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {plaidItems.map(item => {
            const id = item._id;
            const isHovered = hoveredId === id;
            return (
              <button
                key={id}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  width: '100%', padding: '1rem 1.25rem',
                  background: isHovered ? T.surfaceHov : T.surface,
                  border: `1px solid ${isHovered ? T.borderHov : T.border}`,
                  borderRadius: '12px', cursor: 'pointer',
                  fontFamily: T.sans, textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                  background: T.accentBg, border: `1px solid ${T.accentBord}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', fontWeight: 700, color: T.accent,
                }}>
                  {(item.institutionName || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.92rem', fontWeight: 500, color: T.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.institutionName || 'Unknown Bank'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: T.muted, marginTop: '0.15rem' }}>
                    This bank only · {item.status === 'active' ? 'Connected' : item.status || 'Connected'}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            );
          })}

          <button
            onClick={onAddNew}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              width: '100%', padding: '0.85rem',
              background: 'transparent',
              border: `1px dashed ${T.border}`,
              borderRadius: '12px', cursor: 'pointer',
              fontFamily: T.sans, fontSize: '0.85rem', fontWeight: 500,
              color: T.muted, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHov; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add new bank
          </button>
        </div>
      </div>
    </div>
  );
}
