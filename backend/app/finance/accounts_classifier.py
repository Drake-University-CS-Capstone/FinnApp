"""
accounts_classifier.py
======================
Canonical mapping from Plaid account type/subtype into high-level UI buckets.

Plaid returns a very broad set of account types — treating every one of them as
a "bank account" in the main display produces confusing results (e.g. a
mortgage or a 401k appearing as a spendable balance).  This module defines a
single source of truth so every route, endpoint, and UI panel agrees on how to
group things.

Buckets (AccountClass):
  - CASH        -> checking / savings / cash-management / money-market /
                   paypal / hsa / normal liquid depository balances.
  - DEBT        -> credit cards, student loans, auto loans, personal loans,
                   mortgages, line of credit, overdraft.
  - INVESTMENT  -> brokerage + retirement (401k / IRA / Roth / 403b / 457 /
                   529 / SEP / SIMPLE / pension / thrift / keogh / mutual
                   fund / annuity / trust / utma / stock-plan / isa).
  - OTHER       -> anything that doesn't fit the above (insurance, business
                   accounts we can't place, unknown/exotic subtypes).

Design notes:
  - Mapping is driven by (type, subtype) with sensible type-level fallbacks.
  - Case-insensitive on both; Plaid has shipped mixed case in the past.
  - Unknown subtypes under a known type fall back to the type's default.
  - `other_asset` / `other_liability` route to INVESTMENT / DEBT respectively
    so the main spendable view stays clean.

Consumers:
  - backend/app/routes/plaid_extended.py  (insights, net_worth, accounts grouping)
  - backend/app/routes/accounts.py        (grouped account listing)
  - anything else needing "is this a cash-spendable account?" logic
"""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Tuple


class AccountClass:
    """Enum-ish namespace of canonical account groups."""

    CASH = "cash"
    DEBT = "debt"
    INVESTMENT = "investment"
    OTHER = "other"


# ---------------------------------------------------------------------------
# Subtype-level mapping
# ---------------------------------------------------------------------------
# Keys are normalized (type, subtype) pairs; values are AccountClass buckets.
# When a subtype is not in this table we fall back to _TYPE_FALLBACK below.
_SUBTYPE_MAP: Dict[Tuple[str, str], str] = {
    # --- depository (cash-like by default, with a few carve-outs) ---
    ("depository", "checking"): AccountClass.CASH,
    ("depository", "savings"): AccountClass.CASH,
    ("depository", "hsa"): AccountClass.CASH,  # spendable in practice
    ("depository", "cd"): AccountClass.INVESTMENT,  # locked; treat as investment
    ("depository", "money market"): AccountClass.CASH,
    ("depository", "paypal"): AccountClass.CASH,
    ("depository", "prepaid"): AccountClass.CASH,
    ("depository", "cash management"): AccountClass.CASH,
    ("depository", "ebt"): AccountClass.CASH,

    # --- credit ---
    ("credit", "credit card"): AccountClass.DEBT,
    ("credit", "paypal"): AccountClass.DEBT,  # PayPal Credit line
    ("credit", "overdraft"): AccountClass.DEBT,

    # --- loan (always debt) ---
    ("loan", "auto"): AccountClass.DEBT,
    ("loan", "business"): AccountClass.DEBT,
    ("loan", "commercial"): AccountClass.DEBT,
    ("loan", "construction"): AccountClass.DEBT,
    ("loan", "consumer"): AccountClass.DEBT,
    ("loan", "home equity"): AccountClass.DEBT,
    ("loan", "loan"): AccountClass.DEBT,
    ("loan", "mortgage"): AccountClass.DEBT,
    ("loan", "overdraft"): AccountClass.DEBT,
    ("loan", "line of credit"): AccountClass.DEBT,
    ("loan", "student"): AccountClass.DEBT,
    ("loan", "other"): AccountClass.DEBT,

    # --- investment (all subtypes route to INVESTMENT) ---
    ("investment", "401a"): AccountClass.INVESTMENT,
    ("investment", "401k"): AccountClass.INVESTMENT,
    ("investment", "403b"): AccountClass.INVESTMENT,
    ("investment", "457b"): AccountClass.INVESTMENT,
    ("investment", "529"): AccountClass.INVESTMENT,
    ("investment", "brokerage"): AccountClass.INVESTMENT,
    ("investment", "cash isa"): AccountClass.INVESTMENT,
    ("investment", "crypto exchange"): AccountClass.INVESTMENT,
    ("investment", "education savings account"): AccountClass.INVESTMENT,
    ("investment", "fixed annuity"): AccountClass.INVESTMENT,
    ("investment", "gic"): AccountClass.INVESTMENT,
    ("investment", "health reimbursement arrangement"): AccountClass.INVESTMENT,
    ("investment", "hsa"): AccountClass.INVESTMENT,
    ("investment", "ira"): AccountClass.INVESTMENT,
    ("investment", "isa"): AccountClass.INVESTMENT,
    ("investment", "keogh"): AccountClass.INVESTMENT,
    ("investment", "lif"): AccountClass.INVESTMENT,
    ("investment", "life insurance"): AccountClass.INVESTMENT,
    ("investment", "lira"): AccountClass.INVESTMENT,
    ("investment", "lrif"): AccountClass.INVESTMENT,
    ("investment", "lrsp"): AccountClass.INVESTMENT,
    ("investment", "mutual fund"): AccountClass.INVESTMENT,
    ("investment", "non-custodial wallet"): AccountClass.INVESTMENT,
    ("investment", "non-taxable brokerage account"): AccountClass.INVESTMENT,
    ("investment", "other"): AccountClass.INVESTMENT,
    ("investment", "other annuity"): AccountClass.INVESTMENT,
    ("investment", "other insurance"): AccountClass.INVESTMENT,
    ("investment", "pension"): AccountClass.INVESTMENT,
    ("investment", "prif"): AccountClass.INVESTMENT,
    ("investment", "profit sharing plan"): AccountClass.INVESTMENT,
    ("investment", "qshr"): AccountClass.INVESTMENT,
    ("investment", "rdsp"): AccountClass.INVESTMENT,
    ("investment", "resp"): AccountClass.INVESTMENT,
    ("investment", "retirement"): AccountClass.INVESTMENT,
    ("investment", "rlif"): AccountClass.INVESTMENT,
    ("investment", "roth"): AccountClass.INVESTMENT,
    ("investment", "roth 401k"): AccountClass.INVESTMENT,
    ("investment", "rrif"): AccountClass.INVESTMENT,
    ("investment", "rrsp"): AccountClass.INVESTMENT,
    ("investment", "sarsep"): AccountClass.INVESTMENT,
    ("investment", "sep ira"): AccountClass.INVESTMENT,
    ("investment", "simple ira"): AccountClass.INVESTMENT,
    ("investment", "sipp"): AccountClass.INVESTMENT,
    ("investment", "stock plan"): AccountClass.INVESTMENT,
    ("investment", "tfsa"): AccountClass.INVESTMENT,
    ("investment", "thrift savings plan"): AccountClass.INVESTMENT,
    ("investment", "trust"): AccountClass.INVESTMENT,
    ("investment", "ugma"): AccountClass.INVESTMENT,
    ("investment", "utma"): AccountClass.INVESTMENT,
    ("investment", "variable annuity"): AccountClass.INVESTMENT,

    # --- brokerage is sometimes emitted as its own legacy type ---
    ("brokerage", "brokerage"): AccountClass.INVESTMENT,
    ("brokerage", "cash management"): AccountClass.INVESTMENT,

    # --- other Plaid buckets we want to keep off the cash rail ---
    ("other", "other asset"): AccountClass.INVESTMENT,
    ("other", "other liability"): AccountClass.DEBT,
}


# Type-level fallback when subtype is missing, unknown, or newly introduced.
_TYPE_FALLBACK: Dict[str, str] = {
    "depository": AccountClass.CASH,
    "credit": AccountClass.DEBT,
    "loan": AccountClass.DEBT,
    "investment": AccountClass.INVESTMENT,
    "brokerage": AccountClass.INVESTMENT,
    "other": AccountClass.OTHER,
}


def _norm(v: Optional[str]) -> str:
    return (v or "").strip().lower()


def classify_account(account: dict) -> str:
    """
    Return the canonical AccountClass for a single account dict.

    Accepts either:
      - our DB shape:   {"type": ..., "subtype": ..., ...}
      - a Plaid shape:  {"type": ..., "subtype": ..., ...}
    (keys are the same for type/subtype between the two).

    Prefers explicit subtype mapping, then falls back to type.  Unknown values
    return AccountClass.OTHER so they never silently show up as "cash".
    """
    t = _norm(account.get("type"))
    s = _norm(account.get("subtype"))

    # Exact (type, subtype) hit.
    hit = _SUBTYPE_MAP.get((t, s))
    if hit:
        return hit

    # Type-level fallback for unknown subtypes under a known type.
    if t in _TYPE_FALLBACK:
        return _TYPE_FALLBACK[t]

    return AccountClass.OTHER


def classify_account_group(account: dict) -> str:
    """Alias for readability at call sites that care about the 'group' concept."""
    return classify_account(account)


def is_cash_account(account: dict) -> bool:
    return classify_account(account) == AccountClass.CASH


def is_debt_account(account: dict) -> bool:
    return classify_account(account) == AccountClass.DEBT


def is_investment_account(account: dict) -> bool:
    return classify_account(account) == AccountClass.INVESTMENT


def group_accounts(accounts: Iterable[dict]) -> Dict[str, List[dict]]:
    """
    Bucket a list of account dicts into {cash, debt, investment, other}.

    Each account is returned unchanged other than an added `account_class`
    field (idempotent — overwritten every call).
    """
    buckets: Dict[str, List[dict]] = {
        AccountClass.CASH: [],
        AccountClass.DEBT: [],
        AccountClass.INVESTMENT: [],
        AccountClass.OTHER: [],
    }
    for a in accounts or []:
        klass = classify_account(a)
        tagged = dict(a)
        tagged["account_class"] = klass
        buckets[klass].append(tagged)
    return buckets
