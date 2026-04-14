from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from app.middleware.auth_required import auth_required
from app.models.transactions import (
    create_transaction,
    get_transaction_by_id,
    get_transactions_by_user_id,
    get_transactions_by_account_id,
    get_transactions_by_connection_id,
    get_transactions_by_date_range,
    get_transactions_by_amount_range,
    get_transactions_by_category,
    get_transactions_by_merchant,
    get_transactions_by_type,
    get_pending_transactions,
)


transactions_bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")


def _serialize(doc):
    """Convert ObjectId and datetime fields so jsonify can handle them."""
    if doc is None:
        return None
    doc = dict(doc)
    for key in ("_id", "userId", "connectionId", "accountId"):
        if key in doc and isinstance(doc[key], ObjectId):
            doc[key] = str(doc[key])
    for key in ("date", "authorizedDate", "createdAt", "updatedAt"):
        if key in doc and doc[key] is not None:
            doc[key] = doc[key].isoformat() if isinstance(doc[key], datetime) else str(doc[key])
    return doc


def _get_pagination():
    """Extract limit and skip from query params with defaults."""
    try:
        limit = int(request.args.get("limit", 50))
    except (TypeError, ValueError):
        limit = 50
    try:
        skip = int(request.args.get("skip", 0))
    except (TypeError, ValueError):
        skip = 0
    return limit, skip


@transactions_bp.post("/")
@auth_required
def create_transaction_route():
    """Create a single transaction for the logged-in user."""
    user_id = g.user_id
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    connection_id = data.get("connectionId")
    account_id = data.get("accountId")
    if not connection_id or not account_id:
        return jsonify({"error": "connectionId and accountId are required"}), 400

    required = ("plaidTransactionId", "name", "amount", "date")
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    txn = create_transaction(user_id, connection_id, account_id, data)
    if txn:
        return jsonify(_serialize(txn)), 201
    return jsonify({"error": "Failed to create transaction"}), 500


@transactions_bp.get("/")
@auth_required
def get_all_transactions_route():
    """Get all transactions for the logged-in user (paginated)."""
    limit, skip = _get_pagination()
    transactions = get_transactions_by_user_id(g.user_id, limit=limit, skip=skip)
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/by_account")
@auth_required
def get_transactions_by_account_route():
    """Get transactions for a specific account."""
    account_id = request.args.get("account_id")
    if not account_id:
        return jsonify({"error": "account_id query parameter is required"}), 400

    limit, skip = _get_pagination()
    transactions = get_transactions_by_account_id(account_id, limit=limit, skip=skip)
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/by_connection")
@auth_required
def get_transactions_by_connection_route():
    """Get transactions for a specific PlaidItem connection."""
    connection_id = request.args.get("connection_id")
    if not connection_id:
        return jsonify({"error": "connection_id query parameter is required"}), 400

    limit, skip = _get_pagination()
    transactions = get_transactions_by_connection_id(connection_id, limit=limit, skip=skip)
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/by_date_range")
@auth_required
def get_transactions_by_date_range_route():
    """Get transactions within a date range."""
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    if not start_str or not end_str:
        return jsonify({"error": "start_date and end_date query parameters are required"}), 400

    try:
        start_date = datetime.fromisoformat(start_str).replace(tzinfo=timezone.utc)
        end_date = datetime.fromisoformat(end_str).replace(tzinfo=timezone.utc)
    except ValueError:
        return jsonify({"error": "Invalid date format. Use ISO format (e.g. 2026-04-01)"}), 400

    limit, skip = _get_pagination()
    connection_id = request.args.get("connection_id")
    transactions = get_transactions_by_date_range(
        g.user_id, start_date, end_date, limit=limit, skip=skip, connection_id=connection_id
    )
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/by_amount_range")
@auth_required
def get_transactions_by_amount_range_route():
    """Get transactions within an amount range."""
    min_str = request.args.get("min_amount")
    max_str = request.args.get("max_amount")
    if min_str is None or max_str is None:
        return jsonify({"error": "min_amount and max_amount query parameters are required"}), 400

    try:
        min_amount = float(min_str)
        max_amount = float(max_str)
    except ValueError:
        return jsonify({"error": "min_amount and max_amount must be numbers"}), 400

    limit, skip = _get_pagination()
    transactions = get_transactions_by_amount_range(g.user_id, min_amount, max_amount, limit=limit, skip=skip)
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/by_category")
@auth_required
def get_transactions_by_category_route():
    """Get transactions matching a category."""
    category = request.args.get("category")
    if not category:
        return jsonify({"error": "category query parameter is required"}), 400

    limit, skip = _get_pagination()
    transactions = get_transactions_by_category(g.user_id, category, limit=limit, skip=skip)
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/by_merchant")
@auth_required
def get_transactions_by_merchant_route():
    """Get transactions matching a merchant name (partial, case-insensitive)."""
    merchant_name = request.args.get("merchant_name")
    if not merchant_name:
        return jsonify({"error": "merchant_name query parameter is required"}), 400

    limit, skip = _get_pagination()
    transactions = get_transactions_by_merchant(g.user_id, merchant_name, limit=limit, skip=skip)
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/by_type")
@auth_required
def get_transactions_by_type_route():
    """Get transactions matching a transaction type."""
    transaction_type = request.args.get("transaction_type")
    if not transaction_type:
        return jsonify({"error": "transaction_type query parameter is required"}), 400

    limit, skip = _get_pagination()
    transactions = get_transactions_by_type(g.user_id, transaction_type, limit=limit, skip=skip)
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/pending")
@auth_required
def get_pending_transactions_route():
    """Get pending transactions for the logged-in user."""
    limit, skip = _get_pagination()
    transactions = get_pending_transactions(g.user_id, limit=limit, skip=skip)
    return jsonify({"transactions": [_serialize(t) for t in transactions]}), 200


@transactions_bp.get("/<transaction_id>")
@auth_required
def get_transaction_by_id_route(transaction_id):
    """Get a single transaction by its Mongo _id."""
    txn = get_transaction_by_id(transaction_id)
    if txn:
        return jsonify(_serialize(txn)), 200
    return jsonify({"error": "Transaction not found"}), 404
