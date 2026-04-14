import re
import unicodedata
from datetime import datetime, timezone
from app.extensions import get_db
from bson import ObjectId


def utc_now():
    return datetime.now(timezone.utc)


def get_all_accounts_by_user_id(user_id):
    """Get all accounts for a user, sorted by updatedAt descending."""
    collection = get_db()["Accounts"]

    try:
        user_id = ObjectId(user_id)
        result = collection.find({"userId": user_id}).sort("updatedAt", -1)
        return list(result)
    except Exception as e:
        print(f"Error getting all accounts by user ID: {e}")
        return []


def get_accounts_by_connection_id(connection_id):
    """Get all accounts tied to a specific PlaidItem connection."""
    collection = get_db()["Accounts"]

    try:
        connection_id = ObjectId(connection_id)
        result = collection.find({"connectionId": connection_id}).sort("updatedAt", -1)
        return list(result)
    except Exception as e:
        print(f"Error getting accounts by connection ID: {e}")
        return []


def get_account_by_id(account_id):
    """Fetch a single account by its Mongo _id."""
    collection = get_db()["Accounts"]

    try:
        account_id = ObjectId(account_id)
        return collection.find_one({"_id": account_id})
    except Exception as e:
        print(f"Error getting account by ID: {e}")
        return None


def get_account_by_plaid_account_id(user_id, plaid_account_id):
    """Look up an account by its Plaid-assigned plaidAccountId scoped to a user."""
    collection = get_db()["Accounts"]

    try:
        user_id = ObjectId(user_id)
        return collection.find_one({
            "userId": user_id,
            "plaidAccountId": plaid_account_id
        })
    except Exception as e:
        print(f"Error getting account by plaid account ID: {e}")
        return None


def create_account(user_id, connection_id, account_data):
    """Insert a brand-new account document."""
    collection = get_db()["Accounts"]

    try:
        now = utc_now()
        doc = {
            "userId": ObjectId(user_id),
            "connectionId": ObjectId(connection_id),
            "plaidAccountId": account_data.get("plaidAccountId"),
            "name": account_data.get("name"),
            "officialName": account_data.get("officialName"),
            "mask": account_data.get("mask"),
            "type": account_data.get("type"),
            "subtype": account_data.get("subtype"),
            "holderCategory": account_data.get("holderCategory"),
            "availableBalance": account_data.get("availableBalance"),
            "currentBalance": account_data.get("currentBalance"),
            "isoCurrencyCode": account_data.get("isoCurrencyCode"),
            "limit": account_data.get("limit"),
            "unofficialCurrencyCode": account_data.get("unofficialCurrencyCode"),
            "isActive": True,
            "createdAt": now,
            "updatedAt": now,
        }

        result = collection.insert_one(doc)
        return collection.find_one({"_id": result.inserted_id})
    except Exception as e:
        print(f"Error creating account: {e}")
        return None


def upsert_account(user_id, connection_id, account_data):
    """Insert or update an account keyed on (userId, plaidAccountId)."""
    collection = get_db()["Accounts"]

    try:
        user_id_oid = ObjectId(user_id)
        plaid_account_id = account_data.get("plaidAccountId")

        existing = collection.find_one({
            "userId": user_id_oid,
            "plaidAccountId": plaid_account_id
        })

        if existing:
            now = utc_now()
            update_fields = {
                "name": account_data.get("name"),
                "officialName": account_data.get("officialName"),
                "mask": account_data.get("mask"),
                "type": account_data.get("type"),
                "subtype": account_data.get("subtype"),
                "holderCategory": account_data.get("holderCategory"),
                "availableBalance": account_data.get("availableBalance"),
                "currentBalance": account_data.get("currentBalance"),
                "isoCurrencyCode": account_data.get("isoCurrencyCode"),
                "limit": account_data.get("limit"),
                "unofficialCurrencyCode": account_data.get("unofficialCurrencyCode"),
                "updatedAt": now,
            }
            collection.update_one(
                {"_id": existing["_id"]},
                {"$set": update_fields}
            )
            return collection.find_one({"_id": existing["_id"]})

        return create_account(user_id, connection_id, account_data)
    except Exception as e:
        print(f"Error upserting account: {e}")
        return None


def upsert_accounts_bulk(user_id, connection_id, accounts_list):
    """Upsert a list of account dicts. Returns the list of resulting documents."""
    results = []
    for account_data in accounts_list:
        doc = upsert_account(user_id, connection_id, account_data)
        if doc:
            results.append(doc)
    return results


def update_account_balances(account_id, available_balance, current_balance, limit_val):
    """Update only the balance fields on an account."""
    collection = get_db()["Accounts"]

    try:
        account_id = ObjectId(account_id)
        now = utc_now()
        collection.update_one(
            {"_id": account_id},
            {"$set": {
                "availableBalance": available_balance,
                "currentBalance": current_balance,
                "limit": limit_val,
                "updatedAt": now,
            }}
        )
        return collection.find_one({"_id": account_id})
    except Exception as e:
        print(f"Error updating account balances: {e}")
        return None


def deactivate_account(account_id):
    """Soft-delete: sets isActive to False."""
    collection = get_db()["Accounts"]

    try:
        account_id = ObjectId(account_id)
        now = utc_now()
        collection.update_one(
            {"_id": account_id},
            {"$set": {"isActive": False, "updatedAt": now}}
        )
        return collection.find_one({"_id": account_id})
    except Exception as e:
        print(f"Error deactivating account: {e}")
        return None


def deactivate_accounts_by_connection(connection_id):
    """Bulk soft-delete all accounts for a removed PlaidItem connection."""
    collection = get_db()["Accounts"]

    try:
        connection_id = ObjectId(connection_id)
        now = utc_now()
        result = collection.update_many(
            {"connectionId": connection_id},
            {"$set": {"isActive": False, "updatedAt": now}}
        )
        return result.modified_count
    except Exception as e:
        print(f"Error deactivating accounts by connection: {e}")
        return 0


def _fingerprint_account(mask, subtype, name):
    """Stable fingerprint string for matching existing DB account <-> incoming Plaid account."""
    norm = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    norm = re.sub(r"[^a-z0-9]", "", norm.lower())
    return (str(mask or ""), str(subtype or ""), norm)


def remap_accounts_in_place(connection_id, new_plaid_accounts):
    """
    Remap existing Accounts for connection_id to new Plaid account_id values by
    fingerprint matching (mask + subtype + normalized name). No rows are created
    or deleted. Keeps all Mongo _id values stable.

    Returns {"remapped": int, "unmatched_db": [str...], "unmatched_plaid": [str...]}.
    Raises ValueError if any fingerprint is ambiguous (duplicate within DB or Plaid list).
    """
    collection = get_db()["Accounts"]

    existing = list(collection.find({"connectionId": ObjectId(connection_id)}))

    db_by_fp = {}
    for acct in existing:
        fp = _fingerprint_account(acct.get("mask"), acct.get("subtype"), acct.get("name"))
        if fp in db_by_fp:
            raise ValueError(f"Ambiguous account fingerprint in DB: {fp}")
        db_by_fp[fp] = acct

    plaid_by_fp = {}
    for acct in new_plaid_accounts:
        fp = _fingerprint_account(acct.get("mask"), acct.get("subtype"), acct.get("name"))
        if fp in plaid_by_fp:
            raise ValueError(f"Ambiguous account fingerprint from Plaid: {fp}")
        plaid_by_fp[fp] = acct

    remapped = 0
    unmatched_db = []
    matched_plaid_fps = set()
    now = utc_now()

    for fp, db_acct in db_by_fp.items():
        plaid_acct = plaid_by_fp.get(fp)
        if not plaid_acct:
            unmatched_db.append(str(db_acct["_id"]))
            continue
        collection.update_one(
            {"_id": db_acct["_id"]},
            {"$set": {
                "plaidAccountId": plaid_acct.get("plaidAccountId"),
                "name": plaid_acct.get("name"),
                "officialName": plaid_acct.get("officialName"),
                "availableBalance": plaid_acct.get("availableBalance"),
                "currentBalance": plaid_acct.get("currentBalance"),
                "isoCurrencyCode": plaid_acct.get("isoCurrencyCode"),
                "limit": plaid_acct.get("limit"),
                "updatedAt": now,
            }}
        )
        matched_plaid_fps.add(fp)
        remapped += 1

    unmatched_plaid = [
        str(acct.get("plaidAccountId"))
        for fp, acct in plaid_by_fp.items()
        if fp not in matched_plaid_fps
    ]

    return {
        "remapped": remapped,
        "unmatched_db": unmatched_db,
        "unmatched_plaid": unmatched_plaid,
    }
