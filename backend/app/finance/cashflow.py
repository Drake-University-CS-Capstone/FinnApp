"""
cashflow.py
===========
Canonical cashflow math for the app.

This is the *single source of truth* for period cashflow metrics (Income /
Spending / Net). Every page that shows a "last 30 days income" or "monthly
spending" figure should read from here so numbers are consistent.

Key rules (documented here because they are the most common source of
off-by-a-lot bugs):

  R1. Inflow sign convention matches our Mongo `Transactions.amount` column
      (which in turn matches Plaid):
          amount < 0  = money coming INTO the account (inflow)
          amount > 0  = money leaving the account    (outflow)

  R2. Transfers between the user's own accounts are excluded from both Income
      and Spending. Plaid's `personal_finance_category.primary` values
      `TRANSFER_IN` and `TRANSFER_OUT` are the canonical markers. Excluding
      them also eliminates the classic credit-card double-count: the original
      purchase still shows up as a normal-category outflow (counted once),
      while the later payment from checking -> card is TRANSFER_OUT on
      checking and TRANSFER_IN on the card (both excluded).

  R3. The period is defined by an exclusive `now - period_days` cutoff on
      transaction date. The caller controls `period_days`; the default is 30
      because that matches the UI's "last 30 days" phrasing.

  R4. Amounts are bucketed strictly by sign. A TRANSFER category with an
      unusual sign never leaks into the opposite column.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

# -- category rules ---------------------------------------------------------

# Personal-finance-category values we always strip from income/spending.
# These are movements between accounts the user already owns (checking ->
# savings, checking -> credit card payoff, etc.) so they are not real
# income or real spending - they are balance-sheet shuffling.
TRANSFER_PFC = frozenset({"TRANSFER_IN", "TRANSFER_OUT"})

# A few legacy top-level categories that mean the same thing for older rows
# that don't have a personal-finance-category populated yet.
TRANSFER_LEGACY = frozenset({"Transfer", "Payment"})


def _get_pfc_primary(txn: dict) -> Optional[str]:
    pfc = txn.get("personalFinanceCategory") or txn.get("personal_finance_category")
    if isinstance(pfc, dict):
        v = pfc.get("primary") or pfc.get("detailed")
        if v:
            return str(v).upper()
    if isinstance(pfc, str):
        return pfc.upper()
    return None


def _get_legacy_category(txn: dict) -> Optional[str]:
    cat = txn.get("category")
    if isinstance(cat, list) and cat:
        return str(cat[0])
    if isinstance(cat, str):
        return cat
    return None


def is_transfer(txn: dict) -> bool:
    """True if this transaction is a user-owned-account transfer.

    We deliberately keep this narrow - only things Plaid itself has labelled
    as TRANSFER_IN/TRANSFER_OUT. Loan payments (LOAN_PAYMENTS) are NOT
    treated as transfers because from a budgeting perspective they are real
    outflows from the user's discretionary cash, even if they also decrease
    a liability balance.
    """
    pfc = _get_pfc_primary(txn)
    if pfc in TRANSFER_PFC:
        return True
    legacy = _get_legacy_category(txn)
    if legacy in TRANSFER_LEGACY:
        return True
    return False


# -- date helpers -----------------------------------------------------------

def _parse_date(v) -> Optional[datetime]:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    # Accept YYYY-MM-DD strings (what the UI sends after .split('T')[0]).
    s = str(v)[:10]
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        try:
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


# -- amount helpers ---------------------------------------------------------

def _amount(txn: dict) -> Optional[float]:
    a = txn.get("amount")
    if a is None:
        return None
    try:
        return float(a)
    except (TypeError, ValueError):
        return None


# -- canonical computation --------------------------------------------------

def compute_period_cashflow(
    transactions: Iterable[dict],
    *,
    period_days: int = 30,
    now: Optional[datetime] = None,
) -> dict:
    """Compute canonical Income / Spending / Net for a rolling window.

    Returns:
      {
        "period_days":       int,
        "start_date":        ISO date (inclusive),
        "end_date":          ISO date (inclusive),
        "income":            float,   # sum of true inflows, transfers excluded
        "spending":          float,   # sum of true outflows, transfers excluded
        "net":               float,   # income - spending
        "tx_count":          int,     # rows that contributed to income/spending
        "excluded_transfer_count": int,
        "by_category":       [ {category, spending, pct_of_spending}, ... ],
      }
    """
    now = now or datetime.now(timezone.utc)
    start = now - timedelta(days=period_days)

    income = 0.0
    spending = 0.0
    by_cat: dict = {}
    excluded = 0
    counted = 0

    for txn in transactions or []:
        dt = _parse_date(txn.get("date"))
        if dt is None or dt < start or dt > now:
            continue
        amount = _amount(txn)
        if amount is None:
            continue
        if is_transfer(txn):
            excluded += 1
            continue
        if amount < 0:
            income += -amount
            counted += 1
        elif amount > 0:
            spending += amount
            counted += 1
            cat = _get_pfc_primary(txn) or _get_legacy_category(txn) or "OTHER"
            by_cat[cat] = by_cat.get(cat, 0.0) + amount
        # amount == 0 contributes nothing

    net = income - spending
    total_spend = spending if spending > 0 else 1.0
    breakdown = [
        {
            "category": k,
            "spending": round(v, 2),
            "pct_of_spending": round(v / total_spend * 100, 1),
        }
        for k, v in sorted(by_cat.items(), key=lambda kv: -kv[1])
    ]

    return {
        "period_days": period_days,
        "start_date": start.date().isoformat(),
        "end_date": now.date().isoformat(),
        "income": round(income, 2),
        "spending": round(spending, 2),
        "net": round(net, 2),
        "tx_count": counted,
        "excluded_transfer_count": excluded,
        "by_category": breakdown,
    }


__all__ = [
    "TRANSFER_PFC",
    "TRANSFER_LEGACY",
    "is_transfer",
    "compute_period_cashflow",
]
