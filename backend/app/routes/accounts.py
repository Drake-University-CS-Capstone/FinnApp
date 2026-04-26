from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from app.middleware.auth_required import auth_required
from app.finance import AccountClass, classify_account, group_accounts
from app.models.accounts import (
    get_all_accounts_by_user_id,
    get_accounts_by_connection_id,
    get_account_by_id,
    create_account,
    update_account_balances,
    deactivate_account,
)


accounts_bp = Blueprint("accounts", __name__, url_prefix="/api/accounts")


def _serialize(doc):
    """Convert ObjectId and datetime fields so jsonify can handle them.

    Also attaches a canonical `account_class` so every consumer of this route
    agrees on whether an account is cash / debt / investment / other.
    """
    if doc is None:
        return None
    doc = dict(doc)
    for key in ("_id", "userId", "connectionId"):
        if key in doc and isinstance(doc[key], ObjectId):
            doc[key] = str(doc[key])
    for key in ("createdAt", "updatedAt"):
        if key in doc and doc[key] is not None:
            doc[key] = doc[key].isoformat()
    # Tag with canonical account class for the UI (cash/debt/investment/other).
    doc["account_class"] = classify_account(doc)
    return doc


@accounts_bp.get("/")
@auth_required
def get_all_accounts_route():
    """Get all accounts for the logged-in user."""
    user_id = g.user_id
    accounts = get_all_accounts_by_user_id(user_id)
    if accounts:
        return jsonify({"accounts": [_serialize(a) for a in accounts]}), 200
    return jsonify({"error": "No accounts found for this user"}), 404


@accounts_bp.get("/grouped")
@auth_required
def get_grouped_accounts_route():
    """Return all accounts for the user pre-bucketed into cash/debt/investment/other.

    Each bucket entry retains the full serialized account doc (with
    `account_class` attached).  Empty buckets are still returned so the UI
    doesn't have to check for missing keys.
    """
    user_id = g.user_id
    accounts = get_all_accounts_by_user_id(user_id)
    serialized = [_serialize(a) for a in (accounts or [])]
    buckets = group_accounts(serialized)
    return jsonify({
        "groups": {
            AccountClass.CASH: buckets[AccountClass.CASH],
            AccountClass.DEBT: buckets[AccountClass.DEBT],
            AccountClass.INVESTMENT: buckets[AccountClass.INVESTMENT],
            AccountClass.OTHER: buckets[AccountClass.OTHER],
        },
        "counts": {
            k: len(v) for k, v in buckets.items()
        },
    }), 200


@accounts_bp.get("/by_connection")
@auth_required
def get_accounts_by_connection_route():
    """Get all accounts for a specific PlaidItem connection."""
    connection_id = request.args.get("connection_id")
    if not connection_id:
        return jsonify({"error": "connection_id query parameter is required"}), 400

    accounts = get_accounts_by_connection_id(connection_id)
    if accounts:
        return jsonify({"accounts": [_serialize(a) for a in accounts]}), 200
    return jsonify({"error": "No accounts found for connection ID: " + connection_id}), 404


@accounts_bp.get("/<account_id>")
@auth_required
def get_account_by_id_route(account_id):
    """Get a single account by its Mongo _id."""
    account = get_account_by_id(account_id)
    if account:
        return jsonify(_serialize(account)), 200
    return jsonify({"error": "Account not found"}), 404


@accounts_bp.post("/")
@auth_required
def create_account_route():
    """Create a new account for the logged-in user."""
    user_id = g.user_id
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    connection_id = data.get("connectionId")
    if not connection_id:
        return jsonify({"error": "connectionId is required"}), 400

    required = ("plaidAccountId", "name", "type")
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    account = create_account(user_id, connection_id, data)
    if account:
        return jsonify(_serialize(account)), 201
    return jsonify({"error": "Failed to create account"}), 500


@accounts_bp.put("/<account_id>/balances")
@auth_required
def update_account_balances_route(account_id):
    """Update balance fields for a single account."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    account = update_account_balances(
        account_id,
        data.get("availableBalance"),
        data.get("currentBalance"),
        data.get("limit"),
    )
    if account:
        return jsonify(_serialize(account)), 200
    return jsonify({"error": "Failed to update balances"}), 500


@accounts_bp.put("/<account_id>/deactivate")
@auth_required
def deactivate_account_route(account_id):
    """Soft-delete a single account."""
    account = deactivate_account(account_id)
    if account:
        return jsonify(_serialize(account)), 200
    return jsonify({"error": "Failed to deactivate account"}), 500
