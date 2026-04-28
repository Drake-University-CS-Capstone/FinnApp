from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId

from app.extensions import get_db
from app.mongo_bson import bson_safe


def utc_now():
    return datetime.now(timezone.utc)


def upsert_liabilities_snapshot(user_id: str, connection_id: str, payload: dict) -> Optional[dict]:
    """
    Persist a point-in-time liabilities payload for a connection.
    Each call inserts a new document so history is preserved; reads always
    use the most recent row.
    """
    collection = get_db()["PlaidLiabilitiesSnapshots"]
    try:
        now = utc_now()
        doc = {
            "userId": ObjectId(user_id),
            "connectionId": ObjectId(connection_id),
            "fetchedAt": now,
            "payload": bson_safe(payload or {}),
            "createdAt": now,
            "updatedAt": now,
        }
        result = collection.insert_one(doc)
        return collection.find_one({"_id": result.inserted_id})
    except Exception as e:
        print(f"Error upserting liabilities snapshot: {e}")
        return None


def get_latest_liabilities_snapshot(user_id: str, connection_id: str) -> Optional[dict]:
    collection = get_db()["PlaidLiabilitiesSnapshots"]
    try:
        return collection.find_one(
            {"userId": ObjectId(user_id), "connectionId": ObjectId(connection_id)},
            sort=[("fetchedAt", -1)],
        )
    except Exception as e:
        print(f"Error fetching liabilities snapshot: {e}")
        return None


def get_all_latest_liabilities_for_user(user_id: str) -> list:
    """One most-recent snapshot per connection for the user."""
    collection = get_db()["PlaidLiabilitiesSnapshots"]
    try:
        pipeline = [
            {"$match": {"userId": ObjectId(user_id)}},
            {"$sort": {"fetchedAt": -1}},
            {"$group": {"_id": "$connectionId", "doc": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$doc"}},
            {"$sort": {"fetchedAt": -1}},
        ]
        return list(collection.aggregate(pipeline))
    except Exception as e:
        print(f"Error aggregating liabilities snapshots: {e}")
        return []
