"""
plaid_extended.py
=================
New-file-only blueprint for Plaid extended products:
  - /transactions/recurring/get  (recurring cash-flow streams)
  - /liabilities/get             (credit cards, student loans, mortgages)
  - /investments/holdings/get    (portfolio holdings)
  - /investments/transactions/get (buy/sell/dividend activity)

Sync endpoint:  POST /api/plaid_extended/sync/<item_mongo_id>
Read endpoints: GET  /api/plaid_extended/recurring/overview
                GET  /api/plaid_extended/liabilities/summary
                GET  /api/plaid_extended/investments/summary
                GET  /api/plaid_extended/investments/holdings
                GET  /api/plaid_extended/insights
                GET  /api/plaid_extended/net_worth

Does NOT modify backend/app/routes/plaid.py or any legacy model/route file.
The only change to existing files is two lines in backend/app/routes/__init__.py
to import and register this blueprint.
"""

import json
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import plaid
from plaid.api import plaid_api
from plaid.model.liabilities_get_request import LiabilitiesGetRequest
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
from plaid.model.investments_transactions_get_request import InvestmentsTransactionsGetRequest
from plaid.model.transactions_recurring_get_request import TransactionsRecurringGetRequest
from flask import Blueprint, jsonify, g

from app.middleware.auth_required import auth_required
from app.config import Config
from app.finance import (
    AccountClass,
    RECURRING_POLICY,
    build_recurring_view,
    classify_account,
    compute_net_worth,
    compute_period_cashflow,
    group_accounts,
    is_cash_account,
    is_debt_account,
    is_investment_account,
)
from app.models.plaid_items import get_plaid_item_by_id_mongo
from app.models.accounts import get_accounts_by_connection_id, get_all_accounts_by_user_id
from app.models.transactions import get_transactions_by_date_range, get_transactions_by_user_id
from app.models.plaid_liabilities_snapshots import (
    upsert_liabilities_snapshot,
    get_all_latest_liabilities_for_user,
)
from app.models.plaid_investment_snapshots import (
    upsert_investment_snapshot,
    get_all_latest_investment_snapshots_for_user,
)
from app.models.plaid_recurring_snapshots import (
    upsert_recurring_snapshot,
    get_all_latest_recurring_for_user,
)
from app.models.loans import replace_loans_for_connection, get_all_loans_for_user


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------
plaid_extended_bp = Blueprint("plaid_extended", __name__, url_prefix="/api/plaid_extended")

# ---------------------------------------------------------------------------
# Plaid client (same config pattern as plaid.py; independent setup)
# ---------------------------------------------------------------------------
_PLAID_CLIENT_ID = Config.PLAID_CLIENT_ID
_PLAID_SECRET = Config.PLAID_SECRET
_PLAID_ENV = getattr(Config, "PLAID_ENV", "sandbox")

_host = plaid.Environment.Production if _PLAID_ENV == "production" else plaid.Environment.Sandbox

_configuration = plaid.Configuration(
    host=_host,
    api_key={
        "clientId": _PLAID_CLIENT_ID,
        "secret": _PLAID_SECRET,
        "plaidVersion": "2020-09-14",
    },
)
_api_client = plaid.ApiClient(_configuration)
client = plaid_api.PlaidApi(_api_client)

# Plaid error codes that mean a product isn't available for this item —
# these are handled gracefully (stored as null) rather than returning 500.
_PRODUCT_UNAVAILABLE_CODES = {
    "PRODUCT_NOT_ENABLED",
    "PRODUCT_NOT_READY",
    "UNAUTHORIZED_PRODUCT",
    "ITEM_PRODUCT_NOT_ENABLED",
    "INVALID_PRODUCT",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt_error(e: plaid.ApiException) -> dict:
    try:
        body = json.loads(e.body)
    except Exception:
        body = {}
    return {
        "status_code": e.status,
        "error_code": body.get("error_code"),
        "error_type": body.get("error_type"),
        "display_message": body.get("error_message"),
    }


def _is_product_unavailable(e: plaid.ApiException) -> bool:
    try:
        body = json.loads(e.body)
        return body.get("error_code", "") in _PRODUCT_UNAVAILABLE_CODES
    except Exception:
        return False


def _plaid_account_ids_for_connection(connection_id: str) -> list:
    """Return list of plaidAccountId strings for accounts in this connection."""
    accounts = get_accounts_by_connection_id(connection_id)
    return [str(a["plaidAccountId"]) for a in accounts if a.get("plaidAccountId")]


# ---------------------------------------------------------------------------
# Plaid product fetch helpers (each returns (payload_dict, error_info))
# ---------------------------------------------------------------------------

def _fetch_recurring(access_token: str, account_ids: list):
    try:
        req = TransactionsRecurringGetRequest(
            access_token=access_token,
            account_ids=account_ids,
        )
        resp = client.transactions_recurring_get(req).to_dict()
        return resp, None
    except plaid.ApiException as e:
        if _is_product_unavailable(e):
            return None, {"unavailable": True, **_fmt_error(e)}
        return None, _fmt_error(e)
    except Exception as e:
        return None, {"error": str(e)}


def _fetch_liabilities(access_token: str):
    try:
        req = LiabilitiesGetRequest(access_token=access_token)
        resp = client.liabilities_get(req).to_dict()
        return resp, None
    except plaid.ApiException as e:
        if _is_product_unavailable(e):
            return None, {"unavailable": True, **_fmt_error(e)}
        return None, _fmt_error(e)
    except Exception as e:
        return None, {"error": str(e)}


def _fetch_investment_holdings(access_token: str):
    try:
        req = InvestmentsHoldingsGetRequest(access_token=access_token)
        resp = client.investments_holdings_get(req).to_dict()
        return resp, None
    except plaid.ApiException as e:
        if _is_product_unavailable(e):
            return None, {"unavailable": True, **_fmt_error(e)}
        return None, _fmt_error(e)
    except Exception as e:
        return None, {"error": str(e)}


def _fetch_investment_transactions(access_token: str, days: int = 90):
    try:
        start = date.today() - timedelta(days=days)
        end = date.today()
        req = InvestmentsTransactionsGetRequest(
            access_token=access_token,
            start_date=start,
            end_date=end,
        )
        resp = client.investments_transactions_get(req).to_dict()
        return resp, None
    except plaid.ApiException as e:
        if _is_product_unavailable(e):
            return None, {"unavailable": True, **_fmt_error(e)}
        return None, _fmt_error(e)
    except Exception as e:
        return None, {"error": str(e)}


def _build_connection_loan_rows(connection_id: str, liabilities_payload: Optional[dict]) -> list:
    """
    Build normalized loan rows for DB persistence for a single connection.
    Includes:
      - liabilities product rows (credit/student/mortgage)
      - debt-classified account rows (fallback / coverage)
    """
    def _fallback_loan_type(acct: dict) -> str:
        subtype = str(acct.get("subtype") or "").lower()
        acct_type = str(acct.get("type") or "").lower()
        if acct_type == "credit" or "credit" in subtype:
            return "credit"
        if "student" in subtype:
            return "student"
        if "mortgage" in subtype or "home equity" in subtype:
            return "mortgage"
        return "other_debt"

    rows = []
    seen_plaid_account_ids = set()

    liab = (liabilities_payload or {}).get("liabilities") or {}
    for cc in (liab.get("credit") or []):
        acct_id = str(cc.get("account_id") or "")
        if acct_id:
            seen_plaid_account_ids.add(acct_id)
        rows.append({
            "source": "liabilities",
            "loan_type": "credit",
            "plaid_account_id": acct_id or None,
            "name": "Credit Card",
            "type": "credit",
            "subtype": "credit card",
            "current_balance": cc.get("balance_current"),
            "credit_limit": cc.get("credit_limit"),
            "details": _normalize_credit(cc),
        })
    for sl in (liab.get("student") or []):
        acct_id = str(sl.get("account_id") or "")
        if acct_id:
            seen_plaid_account_ids.add(acct_id)
        norm = _normalize_student(sl)
        rows.append({
            "source": "liabilities",
            "loan_type": "student",
            "plaid_account_id": acct_id or None,
            "name": norm.get("loan_name") or "Student Loan",
            "type": "loan",
            "subtype": "student",
            "current_balance": norm.get("origination_principal_amount"),
            "details": norm,
        })
    for mtg in (liab.get("mortgage") or []):
        acct_id = str(mtg.get("account_id") or "")
        if acct_id:
            seen_plaid_account_ids.add(acct_id)
        norm = _normalize_mortgage(mtg)
        rows.append({
            "source": "liabilities",
            "loan_type": "mortgage",
            "plaid_account_id": acct_id or None,
            "name": norm.get("loan_type_description") or "Mortgage",
            "type": "loan",
            "subtype": "mortgage",
            "current_balance": norm.get("outstanding_principal_balance"),
            "details": norm,
        })

    # Fallback debt rows from canonical account classification.
    accounts = get_accounts_by_connection_id(connection_id)
    item = get_plaid_item_by_id_mongo(connection_id)
    institution_name = item.get("institutionName") if item else None
    for acct in accounts or []:
        if not is_debt_account(acct):
            continue
        plaid_account_id = str(acct.get("plaidAccountId") or "")
        if plaid_account_id and plaid_account_id in seen_plaid_account_ids:
            continue
        rows.append({
            "source": "accounts",
            "loan_type": _fallback_loan_type(acct),
            "plaid_account_id": plaid_account_id or None,
            "name": acct.get("name"),
            "official_name": acct.get("officialName"),
            "institution_name": institution_name,
            "type": acct.get("type"),
            "subtype": acct.get("subtype"),
            "current_balance": acct.get("currentBalance"),
            "available_balance": acct.get("availableBalance"),
            "credit_limit": acct.get("limit"),
            "iso_currency_code": acct.get("isoCurrencyCode") or "USD",
            "details": {},
        })
    return rows


# ---------------------------------------------------------------------------
# Sync endpoint
# ---------------------------------------------------------------------------

@plaid_extended_bp.post("/sync/<item_mongo_id>")
@auth_required
def sync_extended(item_mongo_id: str):
    """
    Fetch all extended Plaid products for a plaid_item and persist snapshots.

    Returns a summary of what was synced, including any per-product errors.
    Products that are not enabled on the item return unavailable=True rather
    than a 5xx error so the frontend can handle gracefully.
    """
    user_id = g.user_id

    item = get_plaid_item_by_id_mongo(item_mongo_id)
    if not item:
        return jsonify({"error": "Plaid item not found"}), 404
    if str(item.get("userId")) != user_id:
        return jsonify({"error": "Unauthorized"}), 403

    access_token = item.get("accessToken")
    if not access_token:
        return jsonify({"error": "No access token for this item"}), 400

    connection_id = str(item["_id"])
    account_ids = _plaid_account_ids_for_connection(connection_id)

    summary = {}

    # ── Recurring streams ──────────────────────────────────────────────────
    if account_ids:
        rec_payload, rec_err = _fetch_recurring(access_token, account_ids)
    else:
        rec_payload, rec_err = None, {"unavailable": True, "error_code": "NO_ACCOUNTS"}

    if rec_payload is not None:
        upsert_recurring_snapshot(user_id, connection_id, rec_payload)
        outflow = rec_payload.get("outflow_streams") or []
        inflow = rec_payload.get("inflow_streams") or []
        summary["recurring"] = {
            "ok": True,
            "outflow_count": len(outflow),
            "inflow_count": len(inflow),
        }
    else:
        summary["recurring"] = {"ok": False, "error": rec_err}

    # ── Liabilities ────────────────────────────────────────────────────────
    liab_payload, liab_err = _fetch_liabilities(access_token)
    if liab_payload is not None:
        upsert_liabilities_snapshot(user_id, connection_id, liab_payload)
        liab_data = liab_payload.get("liabilities") or {}
        loan_rows = _build_connection_loan_rows(connection_id, liab_payload)
        persisted_loan_count = replace_loans_for_connection(user_id, connection_id, loan_rows)
        summary["liabilities"] = {
            "ok": True,
            "credit_count": len(liab_data.get("credit") or []),
            "student_count": len(liab_data.get("student") or []),
            "mortgage_count": len(liab_data.get("mortgage") or []),
            "loan_rows_persisted": persisted_loan_count,
        }
    else:
        # Liabilities unavailable: still persist debt accounts from the local
        # Accounts table so loans remain queryable in DB.
        loan_rows = _build_connection_loan_rows(connection_id, None)
        persisted_loan_count = replace_loans_for_connection(user_id, connection_id, loan_rows)
        summary["liabilities"] = {"ok": False, "error": liab_err}
        summary["liabilities"]["loan_rows_persisted"] = persisted_loan_count

    # ── Investment holdings ────────────────────────────────────────────────
    hold_payload, hold_err = _fetch_investment_holdings(access_token)
    if hold_payload is not None:
        upsert_investment_snapshot(user_id, connection_id, "holdings", hold_payload)
        summary["holdings"] = {
            "ok": True,
            "holdings_count": len(hold_payload.get("holdings") or []),
            "securities_count": len(hold_payload.get("securities") or []),
        }
    else:
        summary["holdings"] = {"ok": False, "error": hold_err}

    # ── Investment transactions ────────────────────────────────────────────
    inv_tx_payload, inv_tx_err = _fetch_investment_transactions(access_token)
    if inv_tx_payload is not None:
        upsert_investment_snapshot(
            user_id,
            connection_id,
            "investment_transactions",
            inv_tx_payload,
            meta={"total_investment_transactions": inv_tx_payload.get("total_investment_transactions")},
        )
        summary["investment_transactions"] = {
            "ok": True,
            "count": len(inv_tx_payload.get("investment_transactions") or []),
        }
    else:
        summary["investment_transactions"] = {"ok": False, "error": inv_tx_err}

    return jsonify({"synced": summary}), 200


# ---------------------------------------------------------------------------
# Recurring overview
# ---------------------------------------------------------------------------

@plaid_extended_bp.get("/recurring/overview")
@auth_required
def recurring_overview():
    """Strict hybrid recurring overview.

    Runs two sources of evidence through a single validation policy:
      1. Plaid's own recurring streams (filtered by confidence score).
      2. Our transaction-history detector (cadence + amount variance +
         merchant/category sanity checks).

    The frontend receives only streams that clear the policy's minimum
    confidence bar, plus metadata (`detection_source`, `confidence`,
    `cadence`, `monthly_amount`) so we can be transparent about how each
    stream was identified.
    """
    user_id = g.user_id
    snapshots = get_all_latest_recurring_for_user(user_id)

    # Pull a reasonable transaction history window for the fallback detector.
    # 200 rows covers roughly 1.5-3 months for an active user and keeps this
    # endpoint snappy; tune RECURRING_POLICY / this limit as needed.
    recent_txns = get_transactions_by_user_id(user_id, limit=500, skip=0)

    view = build_recurring_view(snapshots, recent_txns)
    return jsonify(view), 200


def _first_category(cat):
    if isinstance(cat, list) and cat:
        return str(cat[0])
    if isinstance(cat, str):
        return cat
    return None


# ---------------------------------------------------------------------------
# Liabilities summary
# ---------------------------------------------------------------------------

@plaid_extended_bp.get("/liabilities/summary")
@auth_required
def liabilities_summary():
    """
    Aggregated liabilities across all connections.

    Returns credit-card, student-loan, and mortgage objects with key fields
    extracted for the debt dashboard.
    """
    user_id = g.user_id
    rows = get_all_loans_for_user(user_id)
    credit_cards = []
    student_loans = []
    mortgages = []
    debt_accounts = []
    for row in rows or []:
        conn_id = str(row.get("connectionId") or "")
        source = row.get("source")
        loan_type = row.get("loanType")
        details = row.get("details") or {}

        if source == "liabilities" and loan_type == "credit":
            credit_cards.append({**details, "connection_id": conn_id})
            continue
        if source == "liabilities" and loan_type == "student":
            student_loans.append({**details, "connection_id": conn_id})
            continue
        if source == "liabilities" and loan_type == "mortgage":
            mortgages.append({**details, "connection_id": conn_id})
            continue

        debt_accounts.append({
            "plaid_account_id": row.get("plaidAccountId"),
            "name": row.get("name"),
            "official_name": row.get("officialName"),
            "type": row.get("type"),
            "subtype": row.get("subtype"),
            "current_balance": row.get("currentBalance"),
            "available_balance": row.get("availableBalance"),
            "credit_limit": row.get("creditLimit"),
            "iso_currency_code": row.get("isoCurrencyCode") or "USD",
            "connection_id": conn_id or None,
            "institution_name": row.get("institutionName"),
        })

    total_credit_balance = sum(c.get("balance_current", 0) or 0 for c in credit_cards)
    total_credit_limit = sum(c.get("credit_limit", 0) or 0 for c in credit_cards)
    utilization = (
        round(total_credit_balance / total_credit_limit * 100, 1)
        if total_credit_limit > 0 else None
    )

    return jsonify({
        "credit_cards": credit_cards,
        "student_loans": student_loans,
        "mortgages": mortgages,
        "debt_accounts": debt_accounts,
        "summary": {
            "total_credit_balance": round(total_credit_balance, 2),
            "total_credit_limit": round(total_credit_limit, 2),
            "credit_utilization_pct": utilization,
            "credit_card_count": len(credit_cards),
            "student_loan_count": len(student_loans),
            "mortgage_count": len(mortgages),
            "debt_account_count": len(debt_accounts),
        },
    }), 200


def _normalize_credit(cc: dict) -> dict:
    aprs = cc.get("aprs") or []
    purchase_apr = next(
        (a.get("apr_percentage") for a in aprs if a.get("apr_type") == "purchase_apr"),
        None,
    )
    return {
        "account_id": cc.get("account_id"),
        "balance_current": cc.get("balance_current"),
        "balance_last_statement": cc.get("last_statement_balance"),
        "credit_limit": cc.get("credit_limit"),
        "minimum_payment_amount": cc.get("minimum_payment_amount"),
        "next_payment_due_date": str(cc.get("next_payment_due_date")) if cc.get("next_payment_due_date") else None,
        "last_payment_date": str(cc.get("last_payment_date")) if cc.get("last_payment_date") else None,
        "last_payment_amount": cc.get("last_payment_amount"),
        "purchase_apr": purchase_apr,
        "is_overdue": cc.get("is_overdue"),
    }


def _normalize_student(sl: dict) -> dict:
    return {
        "account_id": sl.get("account_id"),
        "loan_name": sl.get("loan_name"),
        "loan_status": (sl.get("loan_status") or {}).get("type"),
        "outstanding_interest_amount": sl.get("outstanding_interest_amount"),
        "origination_principal_amount": sl.get("origination_principal_amount"),
        "interest_rate_percentage": sl.get("interest_rate_percentage"),
        "repayment_plan_type": (sl.get("repayment_plan") or {}).get("type"),
        "minimum_payment_amount": sl.get("minimum_payment_amount"),
        "next_payment_due_date": str(sl.get("next_payment_due_date")) if sl.get("next_payment_due_date") else None,
        "last_payment_date": str(sl.get("last_payment_date")) if sl.get("last_payment_date") else None,
        "last_payment_amount": sl.get("last_payment_amount"),
        "expected_payoff_date": str(sl.get("expected_payoff_date")) if sl.get("expected_payoff_date") else None,
        "is_overdue": sl.get("is_overdue"),
        "pslf_status": (sl.get("pslf_status") or {}).get("estimated_eligibility_date"),
    }


def _normalize_mortgage(mtg: dict) -> dict:
    return {
        "account_id": mtg.get("account_id"),
        "loan_type_description": mtg.get("loan_type_description"),
        "current_late_fee": mtg.get("current_late_fee"),
        "escrow_balance": mtg.get("escrow_balance"),
        "interest_rate_percentage": (mtg.get("interest_rate") or {}).get("percentage"),
        "interest_rate_type": (mtg.get("interest_rate") or {}).get("type"),
        "last_payment_amount": mtg.get("last_payment_amount"),
        "last_payment_date": str(mtg.get("last_payment_date")) if mtg.get("last_payment_date") else None,
        "maturity_date": str(mtg.get("maturity_date")) if mtg.get("maturity_date") else None,
        "next_monthly_payment": mtg.get("next_monthly_payment"),
        "next_payment_due_date": str(mtg.get("next_payment_due_date")) if mtg.get("next_payment_due_date") else None,
        "origination_principal_amount": mtg.get("origination_principal_amount"),
        "outstanding_principal_balance": mtg.get("outstanding_principal_balance"),
        "property_address": mtg.get("property_address"),
        "has_pmi": mtg.get("has_pmi"),
    }


# ---------------------------------------------------------------------------
# Investments summary
# ---------------------------------------------------------------------------

@plaid_extended_bp.get("/investments/summary")
@auth_required
def investments_summary():
    """
    High-level portfolio overview across all connections.

    Returns total market value, asset class breakdown, and top holdings.
    """
    user_id = g.user_id
    snapshots = get_all_latest_investment_snapshots_for_user(user_id, "holdings")

    all_holdings = []
    all_securities = {}

    for snap in snapshots:
        payload = snap.get("payload") or {}
        conn_id = str(snap.get("connectionId", ""))
        for sec in (payload.get("securities") or []):
            all_securities[sec.get("security_id")] = sec
        for h in (payload.get("holdings") or []):
            all_holdings.append({**h, "connection_id": conn_id})

    total_market_value = sum(
        float(h.get("institution_value") or 0) for h in all_holdings
    )

    # Allocation by security type
    type_buckets: dict = {}
    for h in all_holdings:
        sec = all_securities.get(h.get("security_id")) or {}
        sec_type = sec.get("type") or "other"
        type_buckets[sec_type] = type_buckets.get(sec_type, 0) + float(h.get("institution_value") or 0)

    allocation = [
        {"type": t, "value": round(v, 2), "pct": round(v / total_market_value * 100, 1) if total_market_value else 0}
        for t, v in sorted(type_buckets.items(), key=lambda x: -x[1])
    ]

    # Top 10 holdings by value
    top_holdings = sorted(all_holdings, key=lambda h: float(h.get("institution_value") or 0), reverse=True)[:10]
    top_holdings_out = []
    for h in top_holdings:
        sec = all_securities.get(h.get("security_id")) or {}
        top_holdings_out.append({
            "security_id": h.get("security_id"),
            "ticker_symbol": sec.get("ticker_symbol"),
            "name": sec.get("name"),
            "security_type": sec.get("type"),
            "quantity": h.get("quantity"),
            "institution_value": float(h.get("institution_value") or 0),
            "cost_basis": float(h.get("cost_basis") or 0) if h.get("cost_basis") is not None else None,
            "iso_currency_code": h.get("iso_currency_code", "USD"),
            "connection_id": h.get("connection_id"),
        })

    return jsonify({
        "total_market_value": round(total_market_value, 2),
        "allocation": allocation,
        "top_holdings": top_holdings_out,
        "holdings_count": len(all_holdings),
    }), 200


@plaid_extended_bp.get("/investments/holdings")
@auth_required
def investments_holdings():
    """Full paginated holdings list with security details joined in."""
    user_id = g.user_id
    snapshots = get_all_latest_investment_snapshots_for_user(user_id, "holdings")

    result = []
    for snap in snapshots:
        conn_id = str(snap.get("connectionId", ""))
        payload = snap.get("payload") or {}
        sec_map = {s.get("security_id"): s for s in (payload.get("securities") or [])}
        for h in (payload.get("holdings") or []):
            sec = sec_map.get(h.get("security_id")) or {}
            result.append({
                "security_id": h.get("security_id"),
                "ticker_symbol": sec.get("ticker_symbol"),
                "name": sec.get("name"),
                "security_type": sec.get("type"),
                "close_price": sec.get("close_price"),
                "close_price_as_of": str(sec.get("close_price_as_of")) if sec.get("close_price_as_of") else None,
                "quantity": h.get("quantity"),
                "institution_value": float(h.get("institution_value") or 0),
                "institution_price": float(h.get("institution_price") or 0),
                "cost_basis": float(h.get("cost_basis") or 0) if h.get("cost_basis") is not None else None,
                "unrealized_gain": (
                    round(
                        float(h.get("institution_value") or 0) - float(h.get("cost_basis") or 0),
                        2,
                    )
                    if h.get("cost_basis") is not None else None
                ),
                "iso_currency_code": h.get("iso_currency_code", "USD"),
                "account_id": h.get("account_id"),
                "connection_id": conn_id,
            })

    result.sort(key=lambda x: x.get("institution_value", 0), reverse=True)
    return jsonify({"holdings": result, "count": len(result)}), 200


@plaid_extended_bp.get("/investments/transactions")
@auth_required
def investment_transactions():
    """Recent investment transactions (buys/sells/dividends/fees) across all connections."""
    user_id = g.user_id
    snapshots = get_all_latest_investment_snapshots_for_user(user_id, "investment_transactions")

    result = []
    for snap in snapshots:
        conn_id = str(snap.get("connectionId", ""))
        payload = snap.get("payload") or {}
        sec_map = {s.get("security_id"): s for s in (payload.get("securities") or [])}
        for tx in (payload.get("investment_transactions") or []):
            sec = sec_map.get(tx.get("security_id")) or {}
            result.append({
                "investment_transaction_id": tx.get("investment_transaction_id"),
                "account_id": tx.get("account_id"),
                "security_id": tx.get("security_id"),
                "ticker_symbol": sec.get("ticker_symbol"),
                "name": tx.get("name") or sec.get("name"),
                "type": tx.get("type"),
                "subtype": tx.get("subtype"),
                "quantity": tx.get("quantity"),
                "price": float(tx.get("price") or 0),
                "amount": float(tx.get("amount") or 0),
                "fees": float(tx.get("fees") or 0) if tx.get("fees") is not None else None,
                "date": str(tx.get("date")) if tx.get("date") else None,
                "iso_currency_code": tx.get("iso_currency_code", "USD"),
                "connection_id": conn_id,
            })

    result.sort(key=lambda x: x.get("date") or "", reverse=True)
    return jsonify({"investment_transactions": result, "count": len(result)}), 200


# ---------------------------------------------------------------------------
# Insights (derived analytics from stored snapshots + account balances)
# ---------------------------------------------------------------------------

@plaid_extended_bp.get("/insights")
@auth_required
def insights():
    """
    Computed financial insights for the logged-in user.

    Aggregates across all stored snapshots and account balances:
      - Emergency fund ratio
      - Credit utilization
      - Upcoming bills (top 5 recurring outflows)
      - Subscription leak count
      - Savings target status
    """
    user_id = g.user_id

    # ── Account balances ────────────────────────────────────────────────────
    # Use the canonical classifier so "cash" here matches the UI's "cash"
    # group exactly (checking/savings/cash-management/paypal/hsa/...).
    accounts = get_all_accounts_by_user_id(user_id)
    depository_balance = sum(
        float(a.get("currentBalance") or 0)
        for a in accounts
        if is_cash_account(a)
    )

    # ── Liabilities ─────────────────────────────────────────────────────────
    liab_snaps = get_all_latest_liabilities_for_user(user_id)
    total_credit_balance = 0.0
    total_credit_limit = 0.0
    upcoming_payments = []

    for snap in liab_snaps:
        liab = (snap.get("payload") or {}).get("liabilities") or {}
        for cc in (liab.get("credit") or []):
            total_credit_balance += float(cc.get("balance_current") or 0)
            total_credit_limit += float(cc.get("credit_limit") or 0)
            if cc.get("minimum_payment_amount") and cc.get("next_payment_due_date"):
                upcoming_payments.append({
                    "type": "credit_card",
                    "amount": float(cc.get("minimum_payment_amount")),
                    "due_date": str(cc.get("next_payment_due_date")),
                })
        for sl in (liab.get("student") or []):
            if sl.get("minimum_payment_amount") and sl.get("next_payment_due_date"):
                upcoming_payments.append({
                    "type": "student_loan",
                    "amount": float(sl.get("minimum_payment_amount")),
                    "due_date": str(sl.get("next_payment_due_date")),
                })
        for mtg in (liab.get("mortgage") or []):
            if mtg.get("next_monthly_payment") and mtg.get("next_payment_due_date"):
                upcoming_payments.append({
                    "type": "mortgage",
                    "amount": float(mtg.get("next_monthly_payment")),
                    "due_date": str(mtg.get("next_payment_due_date")),
                })

    credit_utilization = (
        round(total_credit_balance / total_credit_limit * 100, 1)
        if total_credit_limit > 0 else None
    )

    # ── Recurring streams (validated) ────────────────────────────────────────
    # Reuse the same strict hybrid detector the /recurring/overview endpoint
    # uses, so insights and the recurring page always agree.  This means
    # subscription detection no longer depends on ad-hoc keyword matching —
    # it's driven by cadence + merchant allow-list + category sanity checks.
    rec_snaps = get_all_latest_recurring_for_user(user_id)
    recent_txns = get_transactions_by_user_id(user_id, limit=500, skip=0)
    recurring_view = build_recurring_view(rec_snaps, recent_txns)

    active_outflows = [
        {
            "merchant_name": s.get("merchant_name") or "Unknown",
            "amount": float(s.get("monthly_amount") or 0),
            "frequency": s.get("frequency"),
            "cadence": s.get("cadence"),
            "category": s.get("category"),
            "personal_finance_category": s.get("personal_finance_category"),
            "detection_source": s.get("detection_source"),
            "confidence": s.get("confidence"),
        }
        for s in recurring_view["outflow_streams"]
        if s.get("is_active")
    ]
    active_inflows = [
        {
            "merchant_name": s.get("merchant_name") or "",
            "amount": float(s.get("monthly_amount") or 0),
            "cadence": s.get("cadence"),
            "detection_source": s.get("detection_source"),
            "confidence": s.get("confidence"),
        }
        for s in recurring_view["inflow_streams"]
        if s.get("is_active")
    ]

    active_outflows.sort(key=lambda x: x["amount"], reverse=True)
    total_recurring_out = recurring_view["summary"]["total_monthly_outflow"]
    total_recurring_in = recurring_view["summary"]["total_monthly_inflow"]

    # Subscription leak: recurring outflows that landed on the merchant
    # allow-list (Netflix, Spotify, Adobe, …) — no keyword guessing.
    from app.finance.recurring_policy import merchant_on_allow_list as _allow
    subscriptions = [
        o for o in active_outflows
        if _allow(o.get("merchant_name") or "")
    ]

    # Emergency fund: 3-month essential spend target (approx from recurring outflows)
    emergency_fund_target = total_recurring_out * 3
    emergency_fund_ratio = (
        round(depository_balance / emergency_fund_target, 2)
        if emergency_fund_target > 0 else None
    )

    # Safe-to-spend: cash minus the next month's validated recurring
    # obligations. We used to subtract every `minimum_payment_amount` on
    # every loan regardless of when it was due, which penalized users
    # with deferred student loans whose "next_payment_due_date" was years
    # away. Using the validated recurring monthly outflow aligns with
    # what the user sees on the Recurring page and matches intuitive
    # "how much do I have left after my regular bills?" semantics.
    safe_to_spend = round(depository_balance - float(total_recurring_out or 0), 2)

    # Nudges
    nudges = []
    if credit_utilization is not None and credit_utilization > 30:
        nudges.append({
            "type": "high_credit_utilization",
            "message": f"Your credit utilization is {credit_utilization}% — aim for below 30% to protect your score.",
            "severity": "warning" if credit_utilization < 60 else "alert",
        })
    if emergency_fund_ratio is not None and emergency_fund_ratio < 1.0:
        months = round(emergency_fund_ratio * 3, 1)
        nudges.append({
            "type": "low_emergency_fund",
            "message": f"You have about {months} months of emergency savings. Target: 3 months.",
            "severity": "warning",
        })
    if subscriptions:
        sub_total = round(sum(s["amount"] for s in subscriptions), 2)
        nudges.append({
            "type": "subscription_spend",
            "message": f"You have {len(subscriptions)} detected streaming/subscription charges totalling ${sub_total}/mo.",
            "severity": "info",
        })
    if safe_to_spend < 0:
        nudges.append({
            "type": "negative_safe_to_spend",
            "message": "Upcoming obligations exceed your current cash balance. Review your budget.",
            "severity": "alert",
        })

    return jsonify({
        "depository_balance": round(depository_balance, 2),
        "credit_utilization_pct": credit_utilization,
        "emergency_fund_ratio": emergency_fund_ratio,
        "emergency_fund_target": round(emergency_fund_target, 2),
        "safe_to_spend": safe_to_spend,
        "total_recurring_monthly_out": round(total_recurring_out, 2),
        "total_recurring_monthly_in": round(total_recurring_in, 2),
        "top_recurring_bills": active_outflows[:5],
        "subscriptions_detected": subscriptions,
        "upcoming_payments": sorted(upcoming_payments, key=lambda x: x.get("due_date") or ""),
        "nudges": nudges,
    }), 200


# ---------------------------------------------------------------------------
# Net worth
# ---------------------------------------------------------------------------

@plaid_extended_bp.get("/net_worth")
@auth_required
def net_worth():
    """
    Aggregate net worth across all connected accounts.

    Canonical math lives in `app.finance.balance_sheet.compute_net_worth`.
    Briefly:
      - Each account contributes exactly once (deduped by plaidAccountId).
      - For every debt account, the dollar figure is `Accounts.currentBalance`
        (Plaid's outstanding-balance field) — not `outstanding_interest_amount`
        or similar sub-fields that caused prior off-by-an-order-of-magnitude
        bugs on student loans.
      - The Loans collection is consulted only to bucket each debt account
        as credit / student / mortgage / other.
      - Investment accounts prefer a holdings-snapshot market value per
        account; they fall back to `currentBalance` when no snapshot exists
        for that specific account.
    """
    user_id = g.user_id
    accounts = get_all_accounts_by_user_id(user_id)
    inv_snaps = get_all_latest_investment_snapshots_for_user(user_id, "holdings")
    loan_rows = get_all_loans_for_user(user_id)

    return jsonify(compute_net_worth(accounts, inv_snaps, loan_rows)), 200


# ---------------------------------------------------------------------------
# Cashflow (canonical period income / spending / net)
# ---------------------------------------------------------------------------

@plaid_extended_bp.get("/cashflow")
@auth_required
def cashflow_overview():
    """
    Canonical cashflow numbers for the app.

    Every page that shows "income in the last 30 days", "spending in the
    last 30 days", or a 30-day net should read from here instead of
    recomputing over in-memory `transactions`. Doing it here guarantees:
      - transfers between own accounts are excluded consistently
        (TRANSFER_IN / TRANSFER_OUT)
      - the period window is a real N-day cutoff on transaction date
      - category breakdown is consistent with the summed spending total

    Query params:
      ?days=30   -> rolling window size (default 30, capped at 180)
    """
    from flask import request  # local import - kept narrow to this handler

    try:
        days = int(request.args.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    days = max(1, min(days, 180))

    user_id = g.user_id
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    # Query by the actual requested date window so a busy user's 30-day total
    # cannot drift because we only inspected the newest N transactions.
    txns = get_transactions_by_date_range(
        user_id,
        start,
        now,
        limit=5000,
        skip=0,
    )

    cashflow = compute_period_cashflow(txns, period_days=days)
    return jsonify(cashflow), 200


# ---------------------------------------------------------------------------
# Grouped accounts (canonical cash / debt / investment split)
# ---------------------------------------------------------------------------

@plaid_extended_bp.get("/accounts/grouped")
@auth_required
def accounts_grouped():
    """Return all user accounts bucketed into cash/debt/investment/other.

    Uses the shared `app.finance.accounts_classifier` so the frontend can
    render each group in its own section without re-implementing type-subtype
    rules in the UI.  Each account dict keeps every Plaid field plus:
      - `account_class`:        canonical bucket id
      - `institution_name`:     denormalized for multi-bank views (best-effort)
    """
    user_id = g.user_id
    accounts = get_all_accounts_by_user_id(user_id)

    # Best-effort institution name join (looked up via each connection).
    institutions: dict = {}
    plaid_items_seen: dict = {}
    for a in accounts or []:
        conn_id = a.get("connectionId")
        if conn_id is None:
            continue
        key = str(conn_id)
        if key in plaid_items_seen:
            continue
        item = get_plaid_item_by_id_mongo(key)
        plaid_items_seen[key] = True
        if item and item.get("institutionName"):
            institutions[key] = item["institutionName"]

    serialized: list = []
    for a in accounts or []:
        doc = dict(a)
        for k in ("_id", "userId", "connectionId"):
            if k in doc and doc[k] is not None:
                doc[k] = str(doc[k])
        for k in ("createdAt", "updatedAt"):
            if k in doc and doc[k] is not None:
                try:
                    doc[k] = doc[k].isoformat()
                except AttributeError:
                    doc[k] = str(doc[k])
        doc["account_class"] = classify_account(doc)
        if doc.get("connectionId") and doc["connectionId"] in institutions:
            doc["institution_name"] = institutions[doc["connectionId"]]
        serialized.append(doc)

    buckets = group_accounts(serialized)
    return jsonify({
        "groups": {
            AccountClass.CASH: buckets[AccountClass.CASH],
            AccountClass.DEBT: buckets[AccountClass.DEBT],
            AccountClass.INVESTMENT: buckets[AccountClass.INVESTMENT],
            AccountClass.OTHER: buckets[AccountClass.OTHER],
        },
        "counts": {k: len(v) for k, v in buckets.items()},
        "totals": {
            AccountClass.CASH: round(sum(float(a.get("currentBalance") or 0) for a in buckets[AccountClass.CASH]), 2),
            AccountClass.DEBT: round(sum(float(a.get("currentBalance") or 0) for a in buckets[AccountClass.DEBT]), 2),
            AccountClass.INVESTMENT: round(sum(float(a.get("currentBalance") or 0) for a in buckets[AccountClass.INVESTMENT]), 2),
            AccountClass.OTHER: round(sum(float(a.get("currentBalance") or 0) for a in buckets[AccountClass.OTHER]), 2),
        },
    }), 200
