from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId

from app.extensions import get_db
from app.mongo_bson import bson_safe


def utc_now():
    return datetime.now(timezone.utc)


def upsert_recurring_snapshot(user_id: str, connection_id: str, payload: dict) -> Optional[dict]:
    """
    Persist a point-in-time recurring-streams payload for a connection.
    payload shape mirrors Plaid's transactions/recurring/get response:
      { "outflow_streams": [...], "inflow_streams": [...] }
    """
    collection = get_db()["PlaidRecurringSnapshots"]
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
        print(f"Error upserting recurring snapshot: {e}")
        return None


def get_latest_recurring_snapshot(user_id: str, connection_id: str) -> Optional[dict]:
    collection = get_db()["PlaidRecurringSnapshots"]
    try:
        return collection.find_one(
            {"userId": ObjectId(user_id), "connectionId": ObjectId(connection_id)},
            sort=[("fetchedAt", -1)],
        )
    except Exception as e:
        print(f"Error fetching recurring snapshot: {e}")
        return None


def get_all_latest_recurring_for_user(user_id: str) -> list:
    """One most-recent snapshot per connection for the user."""
    collection = get_db()["PlaidRecurringSnapshots"]
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
        print(f"Error aggregating recurring snapshots: {e}")
        return []
