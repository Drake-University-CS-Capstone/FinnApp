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
#from ..models.plaid_items import save_plaid_item, get_plaid_item_by_id, get_plaid_item_by_user_id, update_plaid_item_cursor as update_plaid_item_cursor_model
from ..models.plaid_items import upsert_plaid_item, get_plaid_item_by_id_and_user_id, get_all_plaid_items_by_user_id

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
PLAID_PRODUCTS = getattr(Config, "PLAID_PRODUCTS", "transactions,balance").split(",")
PLAID_COUNTRY_CODES = getattr(Config, "PLAID_COUNTRY_CODES", "US").split(",")
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
                client_user_id=str(time.time())  # Replace with real user ID when you add auth
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
    Returns the list of accounts linked to the item.
    Requires Authorization: Bearer <JWT>; user id comes from token (sub), not a custom header.
    """
    access_token = _store.get("access_token")
    user_id = g.user_id
    if not access_token:
        return jsonify({"error": "No account linked. Complete Plaid Link first."}), 400
    try:
        accounts_request = AccountsGetRequest(access_token=access_token)#Get the accounts from the Plaid API
        response = client.accounts_get(accounts_request).to_dict()#Get the response from the Plaid API
        
        """
        Skip this for now since we need to update our backend to use the new schemas and FKs. We still want this plaid api call to save the plaid item to the database.
        plaid_item = None
        print(f"Response: {response}")
        #Get the plaid item from the database
        try:
            #plaid_item = get_plaid_item_by_id(user_id, response['item']["item_id"])#Get the plaid item from the database
            print(f"Plaid item: {plaid_item}")
        except Exception as e:
            print(f"Error getting plaid item: {e}")

        #If the plaid item is not found, save it to the database
        if not plaid_item: 
            try:
                save_plaid_item(response, user_id, access_token)#Save the plaid item to the database
                print(f"Plaid item saved: {plaid_item}")
            except Exception as e:
                print(f"Error saving plaid item: {e}")
        """
        #Return the accounts
        return jsonify({
            "accounts": [_clean_account(a) for a in response.get("accounts", [])]
        })
    except plaid.ApiException as e:
        return jsonify(_format_error(e)), e.status