// cashflowMath.js
// ================
// Frontend mirror of backend/app/finance/cashflow.py.
//
// The backend `/api/plaid_extended/cashflow` endpoint is the canonical source
// for period income / spending / net, and pages should prefer its numbers.
// But when we only have the in-memory `transactions` array (e.g. for tiny
// previews or when the backend call hasn't returned yet) we still need to
// apply the *same* exclusion rules so the preview and the canonical total
// stay consistent.
//
// Rules (match cashflow.py):
//   - amount < 0  -> inflow
//   - amount > 0  -> outflow
//   - exclude TRANSFER_IN / TRANSFER_OUT (account-to-account moves)
//   - enforce a real N-day date window

export const TRANSFER_PFC = new Set(['TRANSFER_IN', 'TRANSFER_OUT']);
const TRANSFER_LEGACY = new Set(['Transfer', 'Payment']);

/**
 * True when the given transaction is a user-owned-account transfer we must
 * strip from income / spending totals (prevents credit-card-payment double
 * counting and checking->savings inflation).
 */
export function isTransfer(tx) {
  if (!tx) return false;
  const pfc = tx.category || tx.personal_finance_category || tx.personalFinanceCategory;
  const primary =
    typeof pfc === 'string'
      ? pfc
      : pfc && (pfc.primary || pfc.detailed);
  if (primary && TRANSFER_PFC.has(String(primary).toUpperCase())) return true;
  const legacyRaw = tx.category_raw || tx.category_detailed || tx.legacy_category;
  if (legacyRaw && TRANSFER_LEGACY.has(String(legacyRaw))) return true;
  return false;
}

function parseTxDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  // Accept "YYYY-MM-DD" or ISO strings.
  const s = String(value).slice(0, 10);
  if (s.length !== 10 || s[4] !== '-' || s[7] !== '-') return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Compute canonical income / spending / net / per-category breakdown
 * from an in-memory transactions array. Uses the same exclusion and
 * period rules as the backend.
 */
export function computePeriodCashflow(transactions, { periodDays = 30, now = new Date() } = {}) {
  const start = new Date(now.getTime());
  start.setDate(start.getDate() - periodDays);

  let income = 0;
  let spending = 0;
  let counted = 0;
  let excluded = 0;
  const byCat = new Map();

  for (const tx of transactions || []) {
    const dt = parseTxDate(tx.date);
    if (!dt || dt < start || dt > now) continue;
    const amount = Number(tx.amount);
    if (!Number.isFinite(amount)) continue;
    if (isTransfer(tx)) {
      excluded += 1;
      continue;
    }
    if (amount < 0) {
      income += -amount;
      counted += 1;
    } else if (amount > 0) {
      spending += amount;
      counted += 1;
      const cat =
        (typeof tx.category === 'string' && tx.category) ||
        (tx.personalFinanceCategory && tx.personalFinanceCategory.primary) ||
        'OTHER';
      byCat.set(cat, (byCat.get(cat) || 0) + amount);
    }
  }

  const totalSpend = spending > 0 ? spending : 1;
  const breakdown = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, s]) => ({
      category,
      spending: Math.round(s * 100) / 100,
      pct_of_spending: Math.round((s / totalSpend) * 1000) / 10,
    }));

  const round2 = (n) => Math.round(n * 100) / 100;

  return {
    period_days: periodDays,
    start_date: start.toISOString().slice(0, 10),
    end_date: now.toISOString().slice(0, 10),
    income: round2(income),
    spending: round2(spending),
    net: round2(income - spending),
    tx_count: counted,
    excluded_transfer_count: excluded,
    by_category: breakdown,
  };
}
