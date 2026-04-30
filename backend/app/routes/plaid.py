import os
import time
import json

from flask import Blueprint, jsonify, request, g
from dotenv import load_dotenv

import plaid
from plaid.api import plaid_api
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from ..config import Config
from app.middleware.auth_required import auth_required
from ..models.plaid_items import (
    upsert_plaid_item,
    get_all_plaid_items_by_user_id,
    get_plaid_item_by_id_mongo,
    update_plaid_item_cursor,
    get_effective_transactions_cursor,
    reconnect_plaid_item_in_place,
    clear_reconnect_mode,
)
from ..models.accounts import upsert_accounts_bulk, get_accounts_by_connection_id, remap_accounts_in_place
from ..models.transactions import upsert_transaction, upsert_transaction_migration, mark_transaction_removed


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------
plaid_bp = Blueprint("plaid", __name__, url_prefix="/api/plaid")

# ---------------------------------------------------------------------------
# Plaid client setup (reads from .env)
# ---------------------------------------------------------------------------
PLAID_CLIENT_ID = Config.PLAID_CLIENT_ID
PLAID_SECRET = Config.PLAID_SECRET
PLAID_ENV = getattr(Config, "PLAID_ENV", "sandbox")
PLAID_PRODUCTS = (getattr(Config, "PLAID_PRODUCTS", "transactions,balance") or "transactions,balance").split(",")
PLAID_COUNTRY_CODES = (getattr(Config, "PLAID_COUNTRY_CODES", "US") or "US").split(",")
PLAID_REDIRECT_URI = getattr(Config, "PLAID_REDIRECT_URI", None)

host = plaid.Environment.Production if PLAID_ENV == "production" else plaid.Environment.Sandbox

configuration = plaid.Configuration(
    host=host,
    api_key={
        "clientId": PLAID_CLIENT_ID,
        "secret": PLAID_SECRET,
        "plaidVersion": "2020-09-14",
    },
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)

products = [Products(p.strip()) for p in PLAID_PRODUCTS]

# ---------------------------------------------------------------------------
# In-memory token store
# NOTE: This is fine for development/demo. For production, store access_token
# in Azure SQL per user (add a PlaidItem model and save it on /set_access_token).
# ---------------------------------------------------------------------------
_store = {
    "access_token": None,
    "item_id": None,
}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _format_error(e: plaid.ApiException) -> dict:
    body = json.loads(e.body)
    return {
        "error": {
            "status_code": e.status,
            "error_code": body.get("error_code"),
            "error_type": body.get("error_type"),
            "display_message": body.get("error_message"),
        }
    }


def _clean_account(a: dict) -> dict:
    bal = a.get("balances", {})
    return {
        "account_id": a.get("account_id"),
        "name": a.get("name"),
        "official_name": a.get("official_name"),
        "type": str(a.get("type", "")),
        "subtype": str(a.get("subtype", "")),
        "balances": {
            "available": bal.get("available"),
            "current": bal.get("current"),
            "limit": bal.get("limit"),
            "iso_currency_code": bal.get("iso_currency_code", "USD"),
        },
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@plaid_bp.post("/create_link_token")
@auth_required
def create_link_token():
    """
    Step 1 of the Plaid Link flow.
    Call this on page load to get a link_token, then pass it to Plaid Link in React.
    """
    try:
        link_request = LinkTokenCreateRequest(
            products=products,
            client_name="Capstone App",
            country_codes=[CountryCode(c.strip()) for c in PLAID_COUNTRY_CODES],
            language="en",
            user=LinkTokenCreateRequestUser(
                client_user_id=g.user_id
            ),
        )
        if PLAID_REDIRECT_URI:
            link_request["redirect_uri"] = PLAID_REDIRECT_URI

        response = client.link_token_create(link_request)
        #print("Link token response:", response)
        return jsonify({"link_token": response["link_token"]})
    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status


@plaid_bp.post("/set_access_token")
def set_access_token():
    """
    Step 2 of the Plaid Link flow.
    React calls this with the public_token returned by Plaid Link's onSuccess callback.
    We exchange it for a permanent access_token and store it in memory.
    """
    public_token = request.json.get("public_token")
    if not public_token:
        return jsonify({"error": "public_token is required"}), 400
    try:
        exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_response = client.item_public_token_exchange(exchange_request)
        #print("Access token response:", exchange_response)
        _store["access_token"] = exchange_response["access_token"]
        _store["item_id"] = exchange_response["item_id"]
        return jsonify({"ok": True, "item_id": _store["item_id"]})
    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status


@plaid_bp.get("/transactions")
def get_transactions():
    """
    Returns the 20 most recent non-pending transactions for the linked account.
    Uses transactions/sync so you always get a fresh, complete picture.

    Response shape:
    {
      "transactions": [ { ...PlaidTransaction fields... }, ... ],
      "total_count": int
    }
    """
    access_token = _store.get("access_token")
    if not access_token:
        return jsonify({"error": "No account linked. Complete Plaid Link first."}), 400

    cursor = ""
    added = []
    has_more = True

    try:
        while has_more:
            sync_request = TransactionsSyncRequest(
                access_token=access_token,
                cursor=cursor,
            )
            response = client.transactions_sync(sync_request).to_dict()
            #print("--------------------------------")
            #print("Type of response:", type(response))
            #print("Transactions sync response:")
            
            #print(json.dumps(response, indent=2, default=str))
            cursor = response["next_cursor"]
            if cursor == "":
                time.sleep(2)
                continue
            added.extend(response["added"])
            has_more = response["has_more"]

        # Sort by date descending, exclude pending, return latest 20
        recent = sorted(
            [t for t in added if not t.get("pending", False)],
            key=lambda t: t["date"],
            reverse=True,
        )[:20]

        # Normalise fields we care about so the frontend has a consistent shape
        def _clean(t: dict) -> dict:
            return {
                "transaction_id": t.get("transaction_id"),
                "name": t.get("merchant_name") or t.get("name"),
                "amount": t.get("amount"),           # positive = expense, negative = income
                "date": str(t.get("date")),          # ISO date string e.g. "2026-02-08"
                "iso_currency_code": t.get("iso_currency_code", "USD"),
                "payment_channel": t.get("payment_channel"),
                "category": (
                    t.get("personal_finance_category", {}).get("primary")
                    if t.get("personal_finance_category")
                    else None
                ),
                "category_detailed": (
                    t.get("personal_finance_category", {}).get("detailed")
                    if t.get("personal_finance_category")
                    else None
                ),
                "account_id": t.get("account_id"),
            }

        return jsonify({
            "transactions": [_clean(t) for t in recent],
            "total_count": len(recent),
        })

    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status


@plaid_bp.get("/balance")
def get_balance():
    """
    Returns real-time balance for all accounts linked to the item.

    Response shape:
    {
      "accounts": [
        {
          "account_id": str,
          "name": str,
          "official_name": str | null,
          "type": str,           // "depository", "credit", etc.
          "subtype": str,        // "checking", "savings", "credit card", etc.
          "balances": {
            "available": float | null,
            "current": float,
            "limit": float | null,
            "iso_currency_code": str
          }
        },
        ...
      ]
    }
    """
    access_token = _store.get("access_token")
    if not access_token:
        return jsonify({"error": "No account linked. Complete Plaid Link first."}), 400

    try:
        balance_request = AccountsBalanceGetRequest(access_token=access_token)
        response = client.accounts_balance_get(balance_request).to_dict()
        #print("Balance response:", json.dumps(response, indent=2))

        return jsonify({
            "accounts": [_clean_account(a) for a in response.get("accounts", [])]
        })

    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status


@plaid_bp.get("/status")
def status():
    """
    Lightweight check the frontend can poll to know if a bank account is linked.
    Response: { "linked": bool, "item_id": str | null }
    """
    return jsonify({
        "linked": _store["access_token"] is not None,
        "item_id": _store["item_id"],
    })
@plaid_bp.get("/accounts")
@auth_required
def get_accounts():
    """
    Returns the list of accounts linked to the item (legacy — uses in-memory token).
    """
    access_token = _store.get("access_token")
    user_id = g.user_id
    if not access_token:
        return jsonify({"error": "No account linked. Complete Plaid Link first."}), 400
    try:
        accounts_request = AccountsGetRequest(access_token=access_token)
        response = client.accounts_get(accounts_request).to_dict()
        return jsonify({
            "accounts": [_clean_account(a) for a in response.get("accounts", [])]
        })
    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status


# ---------------------------------------------------------------------------
# New DB-backed endpoints
# ---------------------------------------------------------------------------

def _build_account_map(connection_id):
    """Build a dict mapping plaidAccountId -> Mongo _id for a connection."""
    accounts = get_accounts_by_connection_id(connection_id)
    return {str(a["plaidAccountId"]): a["_id"] for a in accounts if a.get("plaidAccountId")}


def _plaid_account_to_db(plaid_acct):
    """Convert a Plaid account dict into the shape our accounts model expects."""
    bal = plaid_acct.get("balances", {})
    return {
        "plaidAccountId": plaid_acct.get("account_id"),
        "name": plaid_acct.get("name"),
        "officialName": plaid_acct.get("official_name"),
        "mask": plaid_acct.get("mask"),
        "type": str(plaid_acct.get("type", "")),
        "subtype": str(plaid_acct.get("subtype", "")),
        "availableBalance": bal.get("available"),
        "currentBalance": bal.get("current"),
        "isoCurrencyCode": bal.get("iso_currency_code"),
        "limit": bal.get("limit"),
        "unofficialCurrencyCode": bal.get("unofficial_currency_code"),
    }


def _build_txn_data(txn):
    """Convert a raw Plaid transaction dict to our DB shape."""
    pfc = txn.get("personal_finance_category")
    return {
        "plaidTransactionId": txn.get("transaction_id"),
        "name": txn.get("merchant_name") or txn.get("name"),
        "amount": txn.get("amount"),
        "date": txn.get("date"),
        "authorizedDate": txn.get("authorized_date"),
        "pending": txn.get("pending", False),
        "paymentChannel": txn.get("payment_channel"),
        "transactionType": txn.get("transaction_type"),
        "isoCurrencyCode": txn.get("iso_currency_code"),
        "unofficialCurrencyCode": txn.get("unofficial_currency_code"),
        "merchantName": txn.get("merchant_name"),
        "category": txn.get("category"),
        "categoryId": txn.get("category_id"),
        "personalFinanceCategory": {
            "primary": pfc.get("primary") if pfc else None,
            "detailed": pfc.get("detailed") if pfc else None,
            "confidenceLevel": pfc.get("confidence_level") if pfc else None,
        } if pfc else None,
    }


def _process_sync_batch(user_id, connection_id, account_map, response, migration_mode=False):
    """Apply one transactions/sync response to the DB. Returns (added, modified, removed) counts.
    When migration_mode is True, uses fingerprint-based upsert to avoid duplicating
    historical transactions after a credential rotation (reconnect).
    """
    upsert_fn = upsert_transaction_migration if migration_mode else upsert_transaction
    added_count = modified_count = removed_count = 0

    for txn in response.get("added", []):
        plaid_acct_id = txn.get("account_id")
        account_id = account_map.get(plaid_acct_id)
        if not account_id:
            continue
        upsert_fn(user_id, connection_id, str(account_id), _build_txn_data(txn))
        added_count += 1

    for txn in response.get("modified", []):
        plaid_acct_id = txn.get("account_id")
        account_id = account_map.get(plaid_acct_id)
        if not account_id:
            continue
        upsert_fn(user_id, connection_id, str(account_id), _build_txn_data(txn))
        modified_count += 1

    for txn in response.get("removed", []):
        plaid_txn_id = txn.get("transaction_id")
        if plaid_txn_id:
            mark_transaction_removed(user_id, plaid_txn_id)
            removed_count += 1

    return added_count, modified_count, removed_count


def _plaid_batch_transaction_count(response):
    """How many transaction objects Plaid returned in this batch (before DB mapping)."""
    return (
        len(response.get("added") or [])
        + len(response.get("modified") or [])
        + len(response.get("removed") or [])
    )


def _sync_transactions_for_item(user_id, plaid_item_doc):
    """
    Run Plaid transactions/sync for a stored plaid_item and persist results.
    Skips calling Plaid when there are no linked accounts (nothing to map txns to).
    On first-ever sync (empty cursor), if Plaid's first page has zero transaction rows
    and has_more is false, still advances cursor and returns without looping further.

    When plaid_item_doc["reconnectMode"] is True, uses fingerprint-based migration
    upserts to avoid duplicating historical transactions after a credential rotation.
    Clears reconnectMode on the item after migration sync completes.
    """
    access_token = plaid_item_doc["accessToken"]
    cursor = get_effective_transactions_cursor(plaid_item_doc)
    connection_id = str(plaid_item_doc["_id"])
    is_initial_sync = not cursor
    migration_mode = bool(plaid_item_doc.get("reconnectMode"))

    account_map = _build_account_map(connection_id)
    if not account_map:
        return {
            "added": 0,
            "modified": 0,
            "removed": 0,
            "skipped": True,
            "reason": "no_accounts",
        }

    added_count = 0
    modified_count = 0
    removed_count = 0
    has_more = True
    first_page = True

    while has_more:
        sync_request = TransactionsSyncRequest(
            access_token=access_token,
            cursor=cursor,
        )
        response = client.transactions_sync(sync_request).to_dict()

        next_cursor = response["next_cursor"]
        if next_cursor == "" and cursor == "":
            time.sleep(2)
            continue
        cursor = next_cursor

        raw_total = _plaid_batch_transaction_count(response)
        has_more = response.get("has_more", False)

        if first_page and is_initial_sync and raw_total == 0 and not has_more:
            update_plaid_item_cursor(connection_id, cursor)
            if migration_mode:
                clear_reconnect_mode(connection_id)
            return {
                "added": 0,
                "modified": 0,
                "removed": 0,
                "had_plaid_transactions": False,
            }

        first_page = False
        a, m, r = _process_sync_batch(
            user_id, connection_id, account_map, response, migration_mode=migration_mode
        )
        added_count += a
        modified_count += m
        removed_count += r

    update_plaid_item_cursor(connection_id, cursor)

    if migration_mode:
        clear_reconnect_mode(connection_id)

    return {
        "added": added_count,
        "modified": modified_count,
        "removed": removed_count,
        "had_plaid_transactions": (added_count + modified_count + removed_count) > 0,
        "migrationMode": migration_mode,
    }


@plaid_bp.post("/connect")
@auth_required
def connect_bank():
    """
    First-time bank connection: exchange public token, call accounts/get for
    authoritative item + account payloads, then save plaid_item and accounts.
    """
    user_id = g.user_id
    data = request.get_json() or {}
    public_token = data.get("public_token")
    # Fallbacks if accounts/get fails (Link metadata)
    body_institution_id = data.get("institution_id")
    body_institution_name = data.get("institution_name") or "Unknown"

    if not public_token:
        return jsonify({"error": "public_token is required"}), 400

    try:
        exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_response = client.item_public_token_exchange(exchange_request)
        access_token = exchange_response["access_token"]
        exchange_item_id = exchange_response["item_id"]
    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status

    plaid_accounts = []
    item_obj = {}
    try:
        accounts_request = AccountsGetRequest(access_token=access_token)
        accounts_response = client.accounts_get(accounts_request).to_dict()
        plaid_accounts = accounts_response.get("accounts") or []
        item_obj = accounts_response.get("item") or {}
    except plaid.ApiException as e:
        print(f"Error: accounts/get failed during connect: {e}")
        return jsonify({
            "error": "Could not load accounts from Plaid after linking. Try again.",
            "detail": _format_error(e),
        }), 502

    # Authoritative item fields from Plaid (same payload as Link uses post-exchange)
    plaid_item_id = item_obj.get("item_id") or exchange_item_id
    institution_id = item_obj.get("institution_id") or body_institution_id
    institution_name = item_obj.get("institution_name") or body_institution_name

    if not institution_id:
        return jsonify({
            "error": "Plaid did not return institution_id and none was provided.",
        }), 400

    plaid_item = upsert_plaid_item(
        user_id, institution_id, institution_name, plaid_item_id, access_token
    )
    if not plaid_item:
        return jsonify({"error": "Failed to save plaid item"}), 500

    connection_id = str(plaid_item["_id"])
    db_accounts = [_plaid_account_to_db(a) for a in plaid_accounts]

    if plaid_item.get("reconnectMode"):
        # Item ID rotated: try to remap existing account rows in place by fingerprint.
        # If remap is ambiguous, leave existing accounts untouched and skip the sync
        # for this pass — this is safer than falling back to upsert_accounts_bulk,
        # which would insert new rows for the new Plaid account_ids and cause duplicate
        # accounts and transactions.
        remap_warning = None
        try:
            remap_accounts_in_place(connection_id, db_accounts)
        except ValueError as e:
            remap_warning = str(e)
            print(f"Warning: account remap ambiguous, skipping account + transaction update: {e}")
            # Clear reconnectMode so subsequent syncs don't stay in migration mode forever
            clear_reconnect_mode(connection_id)
            return jsonify({
                "plaidItem": {
                    "_id": connection_id,
                    "institutionId": institution_id,
                    "institutionName": institution_name,
                    "status": "active",
                },
                "sync": {"added": 0, "modified": 0, "removed": 0},
                "warning": f"Account mapping ambiguous ({remap_warning}). "
                           "Existing accounts and transactions preserved. "
                           "Use the re-authenticate flow to update credentials.",
            }), 201
    else:
        upsert_accounts_bulk(user_id, connection_id, db_accounts)

    try:
        sync_summary = _sync_transactions_for_item(user_id, plaid_item)
    except plaid.ApiException as e:
        print(f"Warning: initial sync failed during connect: {e}")
        sync_summary = {"added": 0, "modified": 0, "removed": 0}

    return jsonify({
        "plaidItem": {
            "_id": connection_id,
            "institutionId": institution_id,
            "institutionName": institution_name,
            "status": "active",
        },
        "sync": sync_summary,
    }), 201


@plaid_bp.post("/sync/<plaid_item_id>")
@auth_required
def sync_transactions(plaid_item_id):
    """
    Sync transactions for a stored plaid_item using its access token and cursor.
    """
    user_id = g.user_id

    plaid_item = get_plaid_item_by_id_mongo(plaid_item_id)
    if not plaid_item:
        return jsonify({"error": "Plaid item not found"}), 404

    if str(plaid_item.get("userId")) != user_id:
        return jsonify({"error": "Unauthorized"}), 403

    try:
        sync_summary = _sync_transactions_for_item(user_id, plaid_item)
        return jsonify({"synced": sync_summary}), 200
    except plaid.ApiException as e:
        body = json.loads(e.body)
        error_code = body.get("error_code", "")
        if error_code == "ITEM_LOGIN_REQUIRED":
            return jsonify({
                "error": "Bank connection needs re-authentication",
                "requiresReauth": True,
            }), 400
        return jsonify(_format_error(e)), e.status


@plaid_bp.post("/create_reconnect_token")
@auth_required
def create_reconnect_link_token():
    """
    Create a Plaid link token in update mode for credential rotation.
    The frontend uses this token to open Plaid Link for a reconnect flow.
    Body: { plaid_item_mongo_id: string }
    """
    user_id = g.user_id
    data = request.get_json() or {}
    plaid_item_mongo_id = data.get("plaid_item_mongo_id")

    if not plaid_item_mongo_id:
        return jsonify({"error": "plaid_item_mongo_id is required"}), 400

    plaid_item = get_plaid_item_by_id_mongo(plaid_item_mongo_id)
    if not plaid_item:
        return jsonify({"error": "Plaid item not found"}), 404

    if str(plaid_item.get("userId")) != user_id:
        return jsonify({"error": "Unauthorized"}), 403

    try:
        link_request = LinkTokenCreateRequest(
            client_name="Capstone App",
            country_codes=[CountryCode(c.strip()) for c in PLAID_COUNTRY_CODES],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id=user_id),
            access_token=plaid_item["accessToken"],
        )
        response = client.link_token_create(link_request)
        return jsonify({"link_token": response["link_token"]})
    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status


@plaid_bp.post("/reconnect/<plaid_item_mongo_id>")
@auth_required
def reconnect_bank(plaid_item_mongo_id):
    """
    Credential rotation after update-mode Link:
      1) Exchange new public_token for access_token + item_id
      2) Update plaid_item credentials in place, reset cursor, set reconnectMode
      3) Remap existing accounts to new Plaid account_ids (no new/deleted rows)
      4) Run migration sync to avoid duplicating historical transactions
    Body: { public_token: string }
    """
    user_id = g.user_id
    data = request.get_json() or {}
    public_token = data.get("public_token")

    if not public_token:
        return jsonify({"error": "public_token is required"}), 400

    plaid_item = get_plaid_item_by_id_mongo(plaid_item_mongo_id)
    if not plaid_item:
        return jsonify({"error": "Plaid item not found"}), 404

    if str(plaid_item.get("userId")) != user_id:
        return jsonify({"error": "Unauthorized"}), 403

    # Exchange new public token
    try:
        exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_response = client.item_public_token_exchange(exchange_request)
        access_token = exchange_response["access_token"]
        exchange_item_id = exchange_response["item_id"]
    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status

    # Fetch fresh account list from Plaid
    try:
        accounts_request = AccountsGetRequest(access_token=access_token)
        accounts_response = client.accounts_get(accounts_request).to_dict()
        plaid_accounts = accounts_response.get("accounts") or []
        item_obj = accounts_response.get("item") or {}
    except plaid.ApiException as e:
        return jsonify({
            "error": "Could not load accounts from Plaid after reconnect.",
            "detail": _format_error(e),
        }), 502

    new_plaid_item_id = item_obj.get("item_id") or exchange_item_id
    institution_name = item_obj.get("institution_name") or plaid_item.get("institutionName")

    # Update plaid_item credentials in place, reset cursor, set reconnectMode
    updated_item = reconnect_plaid_item_in_place(
        plaid_item_mongo_id, new_plaid_item_id, access_token, institution_name
    )
    if not updated_item:
        return jsonify({"error": "Failed to update plaid item credentials"}), 500

    connection_id = str(plaid_item["_id"])

    # Remap accounts in place (no inserts/deletes)
    db_accounts = [_plaid_account_to_db(a) for a in plaid_accounts]
    try:
        remap_result = remap_accounts_in_place(connection_id, db_accounts)
    except ValueError as e:
        return jsonify({
            "error": f"Account mapping ambiguous: {str(e)}. Manual reconciliation needed.",
            "requiresManualReconciliation": True,
        }), 409

    # Run migration sync — uses fingerprint upserts to avoid history duplication
    try:
        sync_summary = _sync_transactions_for_item(user_id, updated_item)
    except plaid.ApiException as e:
        print(f"Warning: migration sync failed after reconnect: {e}")
        sync_summary = {"added": 0, "modified": 0, "removed": 0}

    return jsonify({
        "plaidItem": {
            "_id": connection_id,
            "institutionName": institution_name,
            "status": "active",
        },
        "accountsRemapped": remap_result["remapped"],
        "accountsUnmatched": remap_result.get("unmatched_db", []),
        "sync": sync_summary,
    }), 200