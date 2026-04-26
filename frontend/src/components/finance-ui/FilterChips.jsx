import React, { useMemo, useState } from 'react';
import { FINANCE_T as T } from '../../theme/financeTheme';

// Category/filter chip strip with a "show more" affordance so long lists
// (which is common with Plaid category sprawl) stay tidy.
//
// `chips` is an array of { id, label, count? }.
export default function FilterChips({
  chips,
  value,
  onChange,
  initialVisible = 8,
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(() => {
    if (expanded || chips.length <= initialVisible) return chips;
    const selectedIdx = chips.findIndex(c => c.id === value);
    const slice = chips.slice(0, initialVisible);
    // Make sure the selected chip remains visible even if outside the window.
    if (selectedIdx >= initialVisible) {
      slice.pop();
      slice.push(chips[selectedIdx]);
    }
    return slice;
  }, [chips, expanded, initialVisible, value]);

  const hidden = chips.length - visible.length;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
      {visible.map(c => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            style={{
              padding: '0.22rem 0.7rem',
              borderRadius: T.radius.pill,
              fontSize: '0.72rem',
              fontWeight: 500,
              letterSpacing: '0.02em',
              border: `1px solid ${active ? T.accentBord : T.borderSoft}`,
              background: active ? T.accentBg : 'transparent',
              color: active ? T.accent : T.muted,
              cursor: 'pointer',
              fontFamily: T.sans,
              transition: 'all 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = T.borderSoft; e.currentTarget.style.color = T.muted; } }}
          >
            {c.label}
            {c.count != null && (
              <span style={{
                marginLeft: 6,
                color: active ? T.accentStrong : T.mutedDeep,
                fontWeight: 500,
              }}>
                {c.count}
              </span>
            )}
          </button>
        );
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            padding: '0.22rem 0.7rem',
            borderRadius: T.radius.pill,
            fontSize: '0.7rem',
            fontWeight: 600,
            border: `1px dashed ${T.borderSoft}`,
            background: 'transparent',
            color: T.muted,
            cursor: 'pointer',
            fontFamily: T.sans,
            letterSpacing: '0.03em',
          }}
        >
          {expanded ? 'Show less' : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}
