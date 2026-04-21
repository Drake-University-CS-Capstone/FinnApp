import re
import unicodedata
from datetime import date, datetime, time, timezone
from app.extensions import get_db
from bson import ObjectId


def utc_now():
    return datetime.now(timezone.utc)


def _normalize_txn_date(value):
    """
    Plaid's Python SDK returns transaction dates as datetime.date in to_dict().
    PyMongo BSON encoding requires datetime.datetime for BSON date fields.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        s = value.strip()[:10]
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    return value


def _normalize_txn_name(raw):
    """
    Stable, collision-resistant fingerprint for a transaction name.
    Strips non-alphanumeric characters and lowercases so that minor
    differences (punctuation, trailing codes, unicode variants) don't
    cause false mismatches during migration-mode fingerprint matching.
    Uses the same approach as _fingerprint_account in accounts.py.
    """
    if not raw:
        return ""
    norm = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", norm.lower())


def _txn_name_for_fingerprint(txn_data_or_doc):
    """
    Return the normalised name for fingerprint comparison.
    Prefers merchantName (enriched), falls back to name (raw string).
    Works on both txn_data dicts (camelCase) and Mongo documents (camelCase).
    """
    raw = txn_data_or_doc.get("merchantName") or txn_data_or_doc.get("name") or ""
    return _normalize_txn_name(raw)


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
            "date": _normalize_txn_date(txn_data.get("date")),
            "authorizedDate": _normalize_txn_date(txn_data.get("authorizedDate")),
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
                "date": _normalize_txn_date(txn_data.get("date")),
                "authorizedDate": _normalize_txn_date(txn_data.get("authorizedDate")),
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


def upsert_transaction_migration(user_id, connection_id, account_id, txn_data):
    """
    Migration-mode upsert used during the first sync after a reconnect.

    Match priority:
      1) Exact plaidTransactionId match  (normal upsert path — Plaid kept same id)
      2) Fingerprint match: same accountId + date + amount + normalized name
         (Plaid rotated ids but transaction is the same real-world event;
          pending is intentionally excluded — it changes when a txn posts)

    If fingerprint matched, rotate plaidTransactionId in place and update mutable
    fields without inserting a new row.  Only inserts when genuinely no match exists.
    Keeps Mongo _id, accountId, and connectionId stable.
    """
    collection = get_db()["Transactions"]

    try:
        user_id_oid = ObjectId(user_id)
        plaid_transaction_id = txn_data.get("plaidTransactionId")

        # 1) Exact plaidTransactionId match
        existing = collection.find_one({
            "userId": user_id_oid,
            "plaidTransactionId": plaid_transaction_id,
        })

        if not existing:
            # 2) Fingerprint match: accountId + date + amount + normalized name.
            # Deliberately excludes `pending` — a transaction can change from
            # pending=True to pending=False between syncs (posted), so including
            # it would cause false "no match" and duplicate inserts.
            # Name comparison uses _normalize_txn_name (strips non-alphanum) so
            # minor differences (punctuation, trailing codes, enrichment changes
            # between syncs) don't break the match.
            normalized_date = _normalize_txn_date(txn_data.get("date"))
            amount = txn_data.get("amount")
            incoming_name = _txn_name_for_fingerprint(txn_data)

            fingerprint_query = {
                "userId": user_id_oid,
                "accountId": ObjectId(account_id),
                "amount": amount,
                "isRemoved": {"$ne": True},
            }
            if normalized_date:
                fingerprint_query["date"] = normalized_date

            for candidate in collection.find(fingerprint_query):
                if _txn_name_for_fingerprint(candidate) == incoming_name:
                    existing = candidate
                    break

            if not existing:
                print(
                    f"[migration] no fingerprint match → will INSERT "
                    f"plaidTxnId={plaid_transaction_id} "
                    f"accountId={account_id} date={normalized_date} "
                    f"amount={amount} name_norm='{incoming_name}'"
                )

        if existing:
            now = utc_now()
            update_fields = {
                "plaidTransactionId": plaid_transaction_id,
                "name": txn_data.get("name"),
                "amount": txn_data.get("amount"),
                "date": _normalize_txn_date(txn_data.get("date")),
                "authorizedDate": _normalize_txn_date(txn_data.get("authorizedDate")),
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
        print(f"Error in upsert_transaction_migration: {e}")
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


def get_transactions_by_date_range(user_id, start_date, end_date, limit=50, skip=0, connection_id=None):
    """Transactions within a date range (inclusive). Optionally scope to one plaid_item connection."""
    collection = get_db()["Transactions"]

    try:
        query = _build_base_filter(user_id)
        query["date"] = {"$gte": start_date, "$lte": end_date}
        if connection_id:
            query["connectionId"] = ObjectId(connection_id)
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
