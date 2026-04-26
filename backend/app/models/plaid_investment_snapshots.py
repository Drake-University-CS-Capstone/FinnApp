from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId

from app.extensions import get_db
from app.mongo_bson import bson_safe


def utc_now():
    return datetime.now(timezone.utc)


def upsert_investment_snapshot(
    user_id: str,
    connection_id: str,
    kind: str,
    payload: dict,
    meta: Optional[dict] = None,
) -> Optional[dict]:
    """
    Persist a point-in-time investment snapshot for a connection.

    kind: "holdings" | "investment_transactions"
    meta: optional extra scalar fields (e.g. total_investment_transactions count)
    """
    collection = get_db()["PlaidInvestmentSnapshots"]
    try:
        now = utc_now()
        doc = {
            "userId": ObjectId(user_id),
            "connectionId": ObjectId(connection_id),
            "kind": kind,
            "meta": bson_safe(meta or {}),
            "payload": bson_safe(payload or {}),
            "fetchedAt": now,
            "createdAt": now,
            "updatedAt": now,
        }
        result = collection.insert_one(doc)
        return collection.find_one({"_id": result.inserted_id})
    except Exception as e:
        print(f"Error upserting investment snapshot ({kind}): {e}")
        return None


def get_latest_investment_snapshot(user_id: str, connection_id: str, kind: str) -> Optional[dict]:
    collection = get_db()["PlaidInvestmentSnapshots"]
    try:
        return collection.find_one(
            {"userId": ObjectId(user_id), "connectionId": ObjectId(connection_id), "kind": kind},
            sort=[("fetchedAt", -1)],
        )
    except Exception as e:
        print(f"Error fetching investment snapshot ({kind}): {e}")
        return None


def get_all_latest_investment_snapshots_for_user(user_id: str, kind: str) -> list:
    """One most-recent snapshot per connection for the user, filtered by kind."""
    collection = get_db()["PlaidInvestmentSnapshots"]
    try:
        pipeline = [
            {"$match": {"userId": ObjectId(user_id), "kind": kind}},
            {"$sort": {"fetchedAt": -1}},
            {"$group": {"_id": "$connectionId", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$sort": {"fetchedAt": -1}},
        ]
        return list(collection.aggregate(pipeline))
    except Exception as e:
        print(f"Error aggregating investment snapshots ({kind}): {e}")
        return []
