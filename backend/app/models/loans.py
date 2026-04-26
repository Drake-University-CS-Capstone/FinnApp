from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId

from app.extensions import get_db


def utc_now():
    return datetime.now(timezone.utc)


def replace_loans_for_connection(user_id: str, connection_id: str, loan_rows: List[dict]) -> int:
    """
    Replace persisted loan rows for a given user+connection.

    Keeps loan data queryable in Mongo even when Plaid liabilities shape varies.
    """
    collection = get_db()["Loans"]
    now = utc_now()
    try:
        user_oid = ObjectId(user_id)
        conn_oid = ObjectId(connection_id)
        collection.delete_many({"userId": user_oid, "connectionId": conn_oid})
        docs = []
        for row in loan_rows or []:
            docs.append({
                "userId": user_oid,
                "connectionId": conn_oid,
                "source": row.get("source") or "accounts",
                "loanType": row.get("loan_type") or "other_debt",
                "plaidAccountId": row.get("plaid_account_id"),
                "name": row.get("name"),
                "officialName": row.get("official_name"),
                "institutionName": row.get("institution_name"),
                "type": row.get("type"),
                "subtype": row.get("subtype"),
                "currentBalance": row.get("current_balance"),
                "availableBalance": row.get("available_balance"),
                "creditLimit": row.get("credit_limit"),
                "isoCurrencyCode": row.get("iso_currency_code") or "USD",
                "details": row.get("details") or {},
                "createdAt": now,
                "updatedAt": now,
            })
        if docs:
            collection.insert_many(docs)
        return len(docs)
    except Exception as e:
        print(f"Error replacing loans for connection: {e}")
        return 0


def get_all_loans_for_user(user_id: str) -> list:
    collection = get_db()["Loans"]
    try:
        rows = collection.find({"userId": ObjectId(user_id)}).sort("updatedAt", -1)
        return list(rows)
    except Exception as e:
        print(f"Error fetching loans for user: {e}")
        return []

