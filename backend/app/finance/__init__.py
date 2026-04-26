"""
app.finance
===========
Shared finance-domain helpers used by Plaid-backed routes:

- accounts_classifier: canonical mapping from Plaid account type/subtype into
  high-level buckets (cash, debt, investment, other) for UI grouping.
- recurring_policy:    centralized thresholds + merchant/category normalization
  used by the recurring detector.
- recurring_detector:  hybrid recurring-transaction engine that validates
  Plaid's own recurring streams and falls back to transaction-history analysis
  when the Plaid signal is weak or missing.

These modules intentionally have no Flask imports so they are easy to reuse
from any route, script, or future background worker.
"""

from app.finance.accounts_classifier import (
    AccountClass,
    classify_account,
    classify_account_group,
    group_accounts,
    is_cash_account,
    is_debt_account,
    is_investment_account,
)
from app.finance.recurring_policy import RECURRING_POLICY, normalize_merchant
from app.finance.recurring_detector import (
    build_recurring_view,
    detect_recurring_from_transactions,
    validate_plaid_stream,
)
from app.finance.cashflow import (
    TRANSFER_PFC,
    TRANSFER_LEGACY,
    compute_period_cashflow,
    is_transfer,
)
from app.finance.balance_sheet import compute_net_worth

__all__ = [
    "AccountClass",
    "classify_account",
    "classify_account_group",
    "group_accounts",
    "is_cash_account",
    "is_debt_account",
    "is_investment_account",
    "RECURRING_POLICY",
    "normalize_merchant",
    "build_recurring_view",
    "detect_recurring_from_transactions",
    "validate_plaid_stream",
    "TRANSFER_PFC",
    "TRANSFER_LEGACY",
    "compute_period_cashflow",
    "is_transfer",
    "compute_net_worth",
]
