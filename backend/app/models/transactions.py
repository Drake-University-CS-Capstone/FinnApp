import re
from datetime import datetime, timezone
from app.extensions import get_db
from bson import ObjectId


def utc_now():
    return datetime.now(timezone.utc)


def _build_base_filter(user_id):
    """Shared filter: scoped to user, excluding removed transactions."""
    return {
        "userId": ObjectId(user_id),
        "isRemoved": {"$ne": True},
    }


# ---------------------------------------------------------------------------
# Write functions
# ---------------------------------------------------------------------------

def create_transaction(user_id, connection_id, account_id, txn_data):
    """Insert a single transaction document."""
    collection = get_db()["Transactions"]

    try:
        now = utc_now()
        doc = {
            "userId": ObjectId(user_id),
            "connectionId": ObjectId(connection_id),
            "accountId": ObjectId(account_id),
            "plaidTransactionId": txn_data.get("plaidTransactionId"),
            "name": txn_data.get("name"),
            "amount": txn_data.get("amount"),
            "date": txn_data.get("date"),
            "authorizedDate": txn_data.get("authorizedDate"),
            "pending": txn_data.get("pending", False),
            "paymentChannel": txn_data.get("paymentChannel"),
            "transactionType": txn_data.get("transactionType"),
            "isoCurrencyCode": txn_data.get("isoCurrencyCode"),
            "unofficialCurrencyCode": txn_data.get("unofficialCurrencyCode"),
            "merchantName": txn_data.get("merchantName"),
            "category": txn_data.get("category"),
            "categoryId": txn_data.get("categoryId"),
            "personalFinanceCategory": txn_data.get("personalFinanceCategory"),
            "isRemoved": False,
            "createdAt": now,
            "updatedAt": now,
        }

        result = collection.insert_one(doc)
        return collection.find_one({"_id": result.inserted_id})
    except Exception as e:
        print(f"Error creating transaction: {e}")
        return None


def create_transactions_bulk(user_id, connection_id, transactions_list):
    """Insert a list of transactions. Each item must include accountId."""
    results = []
    for txn_data in transactions_list:
        account_id = txn_data.get("accountId")
        doc = create_transaction(user_id, connection_id, account_id, txn_data)
        if doc:
            results.append(doc)
    return results


def upsert_transaction(user_id, connection_id, account_id, txn_data):
    """Insert or update a transaction keyed on (userId, plaidTransactionId)."""
    collection = get_db()["Transactions"]

    try:
        user_id_oid = ObjectId(user_id)
        plaid_transaction_id = txn_data.get("plaidTransactionId")

        existing = collection.find_one({
            "userId": user_id_oid,
            "plaidTransactionId": plaid_transaction_id,
        })

        if existing:
            now = utc_now()
            update_fields = {
                "name": txn_data.get("name"),
                "amount": txn_data.get("amount"),
                "date": txn_data.get("date"),
                "authorizedDate": txn_data.get("authorizedDate"),
                "pending": txn_data.get("pending", False),
                "paymentChannel": txn_data.get("paymentChannel"),
                "transactionType": txn_data.get("transactionType"),
                "isoCurrencyCode": txn_data.get("isoCurrencyCode"),
                "unofficialCurrencyCode": txn_data.get("unofficialCurrencyCode"),
                "merchantName": txn_data.get("merchantName"),
                "category": txn_data.get("category"),
                "categoryId": txn_data.get("categoryId"),
                "personalFinanceCategory": txn_data.get("personalFinanceCategory"),
                "updatedAt": now,
            }
            collection.update_one(
                {"_id": existing["_id"]},
                {"$set": update_fields},
            )
            return collection.find_one({"_id": existing["_id"]})

        return create_transaction(user_id, connection_id, account_id, txn_data)
    except Exception as e:
        print(f"Error upserting transaction: {e}")
        return None


def mark_transaction_removed(user_id, plaid_transaction_id):
    """Mark a transaction as removed (soft-delete via Plaid sync)."""
    collection = get_db()["Transactions"]

    try:
        now = utc_now()
        result = collection.update_one(
            {
                "userId": ObjectId(user_id),
                "plaidTransactionId": plaid_transaction_id,
            },
            {"$set": {"isRemoved": True, "updatedAt": now}},
        )
        return result.modified_count
    except Exception as e:
        print(f"Error marking transaction removed: {e}")
        return 0


# ---------------------------------------------------------------------------
# Read functions -- single lookups
# ---------------------------------------------------------------------------

def get_transaction_by_id(transaction_id):
    """Fetch a single transaction by its Mongo _id."""
    collection = get_db()["Transactions"]

    try:
        return collection.find_one({"_id": ObjectId(transaction_id)})
    except Exception as e:
        print(f"Error getting transaction by ID: {e}")
        return None


def get_transaction_by_plaid_id(user_id, plaid_transaction_id):
    """Fetch a transaction by Plaid's plaidTransactionId scoped to a user."""
    collection = get_db()["Transactions"]

    try:
        return collection.find_one({
            "userId": ObjectId(user_id),
            "plaidTransactionId": plaid_transaction_id,
        })
    except Exception as e:
        print(f"Error getting transaction by plaid ID: {e}")
        return None


# ---------------------------------------------------------------------------
# Read functions -- list queries
# ---------------------------------------------------------------------------

def get_transactions_by_user_id(user_id, limit=50, skip=0):
    """All transactions for a user, paginated."""
    collection = get_db()["Transactions"]

    try:
        query = _build_base_filter(user_id)
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting transactions by user ID: {e}")
        return []


def get_transactions_by_account_id(account_id, limit=50, skip=0):
    """All transactions for a specific account."""
    collection = get_db()["Transactions"]

    try:
        query = {
            "accountId": ObjectId(account_id),
            "isRemoved": {"$ne": True},
        }
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting transactions by account ID: {e}")
        return []


def get_transactions_by_connection_id(connection_id, limit=50, skip=0):
    """All transactions for a specific PlaidItem connection."""
    collection = get_db()["Transactions"]

    try:
        query = {
            "connectionId": ObjectId(connection_id),
            "isRemoved": {"$ne": True},
        }
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting transactions by connection ID: {e}")
        return []


def get_transactions_by_date_range(user_id, start_date, end_date, limit=50, skip=0):
    """Transactions within a date range (inclusive)."""
    collection = get_db()["Transactions"]

    try:
        query = _build_base_filter(user_id)
        query["date"] = {"$gte": start_date, "$lte": end_date}
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting transactions by date range: {e}")
        return []


def get_transactions_by_amount_range(user_id, min_amount, max_amount, limit=50, skip=0):
    """Transactions within an amount range (inclusive)."""
    collection = get_db()["Transactions"]

    try:
        query = _build_base_filter(user_id)
        query["amount"] = {"$gte": min_amount, "$lte": max_amount}
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting transactions by amount range: {e}")
        return []


def get_transactions_by_category(user_id, category, limit=50, skip=0):
    """Transactions matching a personalFinanceCategory.primary value."""
    collection = get_db()["Transactions"]

    try:
        query = _build_base_filter(user_id)
        query["personalFinanceCategory.primary"] = category
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting transactions by category: {e}")
        return []


def get_transactions_by_merchant(user_id, merchant_name, limit=50, skip=0):
    """Transactions matching a merchant name (case-insensitive partial match)."""
    collection = get_db()["Transactions"]

    try:
        query = _build_base_filter(user_id)
        query["merchantName"] = {"$regex": re.escape(merchant_name), "$options": "i"}
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting transactions by merchant: {e}")
        return []


def get_transactions_by_type(user_id, transaction_type, limit=50, skip=0):
    """Transactions matching a transactionType value."""
    collection = get_db()["Transactions"]

    try:
        query = _build_base_filter(user_id)
        query["transactionType"] = transaction_type
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting transactions by type: {e}")
        return []


def get_pending_transactions(user_id, limit=50, skip=0):
    """Pending transactions for a user."""
    collection = get_db()["Transactions"]

    try:
        query = _build_base_filter(user_id)
        query["pending"] = True
        result = (
            collection.find(query)
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(result)
    except Exception as e:
        print(f"Error getting pending transactions: {e}")
        return []
