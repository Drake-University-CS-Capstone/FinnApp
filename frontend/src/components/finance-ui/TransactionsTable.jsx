import React, { useEffect, useMemo, useState } from 'react';
import { FINANCE_T as T, normalizeCategoryLabel } from '../../theme/financeTheme';
import { isTransfer } from '../../finance/cashflowMath';
import DataViewport from './DataViewport';
import FilterChips from './FilterChips';
import SegmentedTabs from './SegmentedTabs';
import { fmtShortDate, fmtUSD } from './fmt';

const GRID = '82px minmax(0,1fr) 110px';

// Single row of the ledger. Kept dense so the table feels like a real
// finance product and more of the list is visible without scrolling.
function Row({ tx }) {
  const isIncome = tx.amount < 0;
  const label = normalizeCategoryLabel(tx.category);
  const supporting = [label, tx.account_name || 'Account'].filter(Boolean).join(' · ');
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: GRID,
      alignItems: 'center', gap: '0.75rem',
      padding: '0.7rem 1rem',
      borderBottom: `1px solid ${T.borderSoft}`,
      transition: 'background 0.12s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ fontSize: T.font.xs, color: T.muted }}>
        {fmtShortDate(tx.date)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: T.font.sm, color: T.text, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {tx.name || '—'}
        </div>
        <div style={{
          fontSize: '0.7rem',
          color: T.muted,
          marginTop: 2,
          display: 'flex',
          gap: '0.35rem',
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {tx.institution_name ? (
            <span style={{ color: T.accent, flexShrink: 0 }}>
              {tx.institution_name}
            </span>
          ) : null}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {supporting}
          </span>
        </div>
      </div>
      <div style={{
        fontSize: T.font.sm, fontWeight: 700, textAlign: 'right',
        color: isIncome ? T.green : T.text, whiteSpace: 'nowrap',
      }}>
        {isIncome ? '+' : '-'}{fmtUSD(tx.amount)}
      </div>
    </div>
  );
}

function GroupHeader({ label, count }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 1,
      padding: '0.4rem 1.1rem',
      fontSize: '0.65rem', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: T.accent,
      background: 'rgba(13,20,36,0.92)',
      borderBottom: `1px solid ${T.borderSoft}`,
      backdropFilter: 'blur(6px)',
    }}>
      {label}
      <span style={{ marginLeft: 8, fontWeight: 500, color: T.muted }}>({count})</span>
    </div>
  );
}

// ── Main table ─────────────────────────────────────────────────────────────
// Owns all category / search / attribution state locally. Keeps the Activity
// page shell thin.
export default function TransactionsTable({
  transactions,
  height = 'min(72vh, 760px)',
  defaultFilter = 'ALL',
  allowSearch = true,
  allowGrouping = true,
  initialGrouping = 'grouped',
  filter: controlledFilter,
  onFilterChange,
  query: controlledQuery,
  onQueryChange,
  grouping: controlledGrouping,
  onGroupingChange,
  onFilteredChange,
}) {
  const txList = transactions || [];
  const [localFilter, setLocalFilter] = useState(defaultFilter);
  const [localGrouping, setLocalGrouping] = useState(initialGrouping);
  const [localQuery, setLocalQuery] = useState('');

  const filter = controlledFilter ?? localFilter;
  const attribution = controlledGrouping ?? localGrouping;
  const query = controlledQuery ?? localQuery;

  const updateFilter = (value) => {
    if (onFilterChange) onFilterChange(value);
    else setLocalFilter(value);
  };
  const updateGrouping = (value) => {
    if (onGroupingChange) onGroupingChange(value);
    else setLocalGrouping(value);
  };
  const updateQuery = (value) => {
    if (onQueryChange) onQueryChange(value);
    else setLocalQuery(value);
  };

  // Build normalized chip list so we never render two "Other" pills from
  // different category slugs.
  const chipDefs = useMemo(() => {
    const counts = new Map();
    for (const t of txList) {
      const key = (t.category || 'OTHER').toString().toUpperCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const byLabel = new Map();
    for (const [key, count] of counts.entries()) {
      const label = normalizeCategoryLabel(key);
      const existing = byLabel.get(label);
      if (existing) {
        existing.count += count;
        existing.ids.push(key);
      } else {
        byLabel.set(label, { id: label, label, count, ids: [key] });
      }
    }
    const all = Array.from(byLabel.values()).sort((a, b) => b.count - a.count);
    return [{ id: 'ALL', label: 'All', count: txList.length, ids: null }, ...all];
  }, [txList]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const selectedIds = chipDefs.find(c => c.id === filter)?.ids;
    return txList.filter(t => {
      if (selectedIds) {
        const key = (t.category || 'OTHER').toString().toUpperCase();
        if (!selectedIds.includes(key)) return false;
      }
      if (needle) {
        const hay = `${t.name || ''} ${t.institution_name || ''} ${normalizeCategoryLabel(t.category)}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [txList, chipDefs, filter, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (da !== db) return db.localeCompare(da);
      return String(b.transaction_id).localeCompare(String(a.transaction_id));
    });
    return list;
  }, [filtered]);

  const grouped = useMemo(() => {
    if (attribution !== 'grouped') return null;
    const m = new Map();
    for (const tx of sorted) {
      const key = tx.institution_name || 'Other';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(tx);
    }
    return Array.from(m.entries());
  }, [sorted, attribution]);

  const totalIn = useMemo(
    () => filtered
      .filter(t => t.amount < 0 && !isTransfer(t))
      .reduce((s, t) => s + Math.abs(t.amount), 0),
    [filtered],
  );
  const totalOut = useMemo(
    () => filtered
      .filter(t => t.amount > 0 && !isTransfer(t))
      .reduce((s, t) => s + t.amount, 0),
    [filtered],
  );

  useEffect(() => {
    if (typeof onFilteredChange === 'function') onFilteredChange(sorted);
  }, [onFilteredChange, sorted]);

  const stickyHeader = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.7rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{
            fontSize: T.font.micro, fontWeight: 700, color: T.muted,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Transactions
          </span>
          <span style={{ fontSize: T.font.xs, color: T.mutedDeep, marginTop: 2 }}>
            {filtered.length} of {txList.length} · in {fmtUSD(totalIn)} · out {fmtUSD(totalOut)} · transfers excluded
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {allowSearch && (
            <input
              className="fin-input"
              type="search"
              value={query}
              onChange={e => updateQuery(e.target.value)}
              placeholder="Search merchant, category…"
              style={{
                padding: '0.38rem 0.8rem',
                fontSize: T.font.xs,
                minWidth: 220,
                borderRadius: T.radius.pill,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: T.text,
                fontFamily: T.sans,
                outline: 'none',
              }}
            />
          )}
          {allowGrouping && (
            <SegmentedTabs
              size="sm"
              label="View"
              tabs={[{ id: 'grouped', label: 'Grouped' }, { id: 'flat', label: 'Flat' }]}
              value={attribution}
              onChange={updateGrouping}
            />
          )}
        </div>
      </div>
      <FilterChips chips={chipDefs} value={filter} onChange={updateFilter} initialVisible={8} />
      <div style={{
        display: 'grid', gridTemplateColumns: GRID, gap: '0.6rem',
        padding: '0.15rem 0',
        fontSize: '0.62rem', fontWeight: 700, color: T.mutedDeep,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        <span>Date</span>
        <span>Merchant, Category, Account</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
      </div>
    </div>
  );

  const isEmpty = sorted.length === 0;

  return (
    <DataViewport
      height={height}
      stickyHeader={stickyHeader}
      isEmpty={isEmpty}
      emptyState={
        txList.length === 0
          ? 'No transactions loaded for this connection yet.'
          : 'No transactions match this filter.'
      }
    >
      {attribution === 'grouped' && grouped
        ? grouped.map(([inst, rows]) => (
            <div key={inst}>
              <GroupHeader label={inst} count={rows.length} />
              {rows.map(tx => <Row key={tx.transaction_id} tx={tx} />)}
            </div>
          ))
        : sorted.map(tx => <Row key={tx.transaction_id} tx={tx} />)
      }
    </DataViewport>
  );
}
