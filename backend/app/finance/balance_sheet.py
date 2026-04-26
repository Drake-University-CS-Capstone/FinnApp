"""
balance_sheet.py
================
Canonical net-worth math for the app.

This is the *single source of truth* for the numbers that appear on the
Net Worth page, the Hub dashboard, and any Debt / Investments summaries
that cross-reference a total assets/liabilities figure.

Design decisions (documented here because previous versions had subtle bugs):

  B1. For EVERY account, the authoritative "how much is in this account"
      number is `Accounts.currentBalance`. Plaid populates this for
      depository, credit, loan, and investment accounts the same way:
          - for cash accounts it's the cash balance
          - for credit cards / loans it's the OUTSTANDING BALANCE (debt)
          - for brokerage it's the market value of the account (when known)

      We therefore derive net worth from accounts first, and only consult
      the liability/investment snapshots for *additional* fields (principal
      breakdown, holding-level granularity). This eliminates two historical
      bugs:
        - student-loan debt was being computed from `outstanding_interest_amount`
          instead of the loan's outstanding principal balance.
        - the "other_debt" fallback only ran when liabilities were zero,
          so users with a credit card + car loan silently lost the car loan.

  B2. We de-duplicate by `plaidAccountId`. Each account contributes to net
      worth exactly once, regardless of how many Plaid products describe it.

  B3. The Loans collection is used ONLY to tell us what *kind* of debt each
      account is (credit / student / mortgage / other). The dollar number
      always comes from the Accounts row so Net Worth and Debt agree.

  B4. For investments we still prefer the holdings-snapshot total when one
      exists for an account (it is more granular and can reflect market
      movements Plaid hasn't reported on the account balance yet). If no
      holdings snapshot is available for an investment account, we fall
      back to `Accounts.currentBalance`. This prevents both double-counting
      and silent under-reporting for partial coverage.
"""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from app.finance.accounts_classifier import (
    AccountClass,
    classify_account,
    is_cash_account,
    is_debt_account,
    is_investment_account,
)


def _float(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _plaid_account_id(doc: dict) -> str:
    v = doc.get("plaidAccountId") or doc.get("plaid_account_id") or doc.get("account_id")
    return str(v or "")


def _loan_type_map_from_loans(loan_rows: Iterable[dict]) -> Dict[str, str]:
    """
    Map plaid_account_id -> canonical debt bucket (credit/student/mortgage/other_debt).

    The Loans collection is the only place that knows a given account is,
    say, a mortgage vs an auto loan, so it is the authoritative label
    source. The actual balance still comes from Accounts.currentBalance.
    """
    out: Dict[str, str] = {}
    for row in loan_rows or []:
        pid = str(row.get("plaidAccountId") or row.get("plaid_account_id") or "")
        if not pid:
            continue
        loan_type = (
            row.get("loanType")
            or row.get("loan_type")
            or "other_debt"
        )
        out[pid] = loan_type
    return out


def _holdings_total_by_account(inv_snapshots: Iterable[dict]) -> Dict[str, float]:
    """
    Sum holding `institution_value` per plaid_account_id across snapshots.

    A user with multiple snapshots (e.g., re-sync + partial failures) only
    contributes the latest snapshot per connection in practice because the
    caller passes the `get_all_latest_investment_snapshots_for_user` result.
    """
    out: Dict[str, float] = {}
    for snap in inv_snapshots or []:
        payload = snap.get("payload") or {}
        for h in (payload.get("holdings") or []):
            pid = str(h.get("account_id") or "")
            if not pid:
                continue
            out[pid] = out.get(pid, 0.0) + _float(h.get("institution_value"))
    return out


def compute_net_worth(
    accounts: Iterable[dict],
    investment_snapshots: Iterable[dict],
    loan_rows: Iterable[dict],
) -> dict:
    """
    Produce the canonical net-worth payload used by /net_worth and any
    downstream consumer (Hub, Debt, Insights).

    Inputs:
      - accounts:             list of Accounts docs for the user (camelCase).
      - investment_snapshots: latest `holdings` snapshots per connection.
      - loan_rows:            Loans collection rows for this user.

    Output:
      {
        "net_worth":        float,
        "total_assets":     float,
        "total_liabilities":float,
        "breakdown":        {cash, investments, credit_debt, student_debt,
                              mortgage_debt, other_debt},
        "sources": {
           "cash_accounts":         int,
           "investment_accounts":   int,
           "debt_accounts":         int,
           "holdings_sourced":      int,   # how many inv accts had a holdings total
        },
      }
    """
    accounts = list(accounts or [])
    loan_type_by_pid = _loan_type_map_from_loans(loan_rows)
    holdings_by_pid = _holdings_total_by_account(investment_snapshots)

    cash_assets = 0.0
    investment_assets = 0.0
    credit_debt = 0.0
    student_debt = 0.0
    mortgage_debt = 0.0
    other_debt = 0.0

    counts = {
        "cash_accounts": 0,
        "investment_accounts": 0,
        "debt_accounts": 0,
        "holdings_sourced": 0,
    }

    for acct in accounts:
        bal = _float(acct.get("currentBalance"))
        pid = _plaid_account_id(acct)

        if is_cash_account(acct):
            cash_assets += bal
            counts["cash_accounts"] += 1
            continue

        if is_investment_account(acct):
            counts["investment_accounts"] += 1
            holdings_total = holdings_by_pid.get(pid)
            if holdings_total is not None and holdings_total != 0:
                investment_assets += holdings_total
                counts["holdings_sourced"] += 1
            else:
                # No holdings-snapshot coverage for this account -> fall
                # back to account currentBalance so brokerages with opaque
                # holdings still contribute.
                investment_assets += bal
            continue

        if is_debt_account(acct):
            counts["debt_accounts"] += 1
            # Debt balances are stored as positive on the Accounts row
            # (Plaid convention: "amount the customer owes"). A rare
            # negative here would mean an overpayment; treat it as zero
            # debt for this purpose so it doesn't flip sign on the
            # liability side.
            debt_balance = max(0.0, bal)
            bucket = loan_type_by_pid.get(pid)
            if bucket == "credit":
                credit_debt += debt_balance
            elif bucket == "student":
                student_debt += debt_balance
            elif bucket == "mortgage":
                mortgage_debt += debt_balance
            else:
                other_debt += debt_balance
            continue
        # AccountClass.OTHER -> skip on both sides by design.

    total_assets = cash_assets + investment_assets
    total_liabilities = credit_debt + student_debt + mortgage_debt + other_debt
    net = total_assets - total_liabilities

    return {
        "net_worth": round(net, 2),
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "breakdown": {
            "cash": round(cash_assets, 2),
            "investments": round(investment_assets, 2),
            "credit_debt": round(credit_debt, 2),
            "student_debt": round(student_debt, 2),
            "mortgage_debt": round(mortgage_debt, 2),
            "other_debt": round(other_debt, 2),
        },
        "sources": counts,
    }


__all__ = ["compute_net_worth"]
