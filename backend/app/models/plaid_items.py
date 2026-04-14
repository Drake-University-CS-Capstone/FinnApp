from datetime import datetime, timezone
from app.extensions import get_db
from bson import ObjectId


def utc_now():
    return datetime.now(timezone.utc)


def get_effective_transactions_cursor(plaid_item_doc):
    """
    Plaid sync cursor may live in `cursor` (schema) or legacy `transactionsCursor`.
    If `cursor` is present but empty while `transactionsCursor` has a value, use the
    legacy field — otherwise a blank required `cursor` resets sync and duplicates txns.
    """
    if not plaid_item_doc:
        return ""
    c = plaid_item_doc.get("cursor")
    legacy = plaid_item_doc.get("transactionsCursor") or ""
    if c not in (None, ""):
        return c
    return legacy or ""


#get all plaid items by user ID
def get_all_plaid_items_by_user_id(user_id):
    """Get all plaid items by user ID."""
    plaid_items_collection = get_db()["plaid_items"]

    try:
        user_id = ObjectId(user_id)
        result = plaid_items_collection.find({"userId": user_id}).sort("updatedAt", -1)
        return list(result)
    except Exception as e:
        print(f"Error getting all plaid items by user ID: {e}")
        return []

#get one plaid item by Plaid item ID and user ID
def get_plaid_item_by_id_and_user_id(user_id, plaid_item_id):
    """
    Get one plaid item by Plaid item ID and user ID.
    plaid_item_id here is the Plaid string ID, not Mongo _id.
    """
    plaid_items_collection = get_db()["plaid_items"]

    try:
        user_id = ObjectId(user_id)
        result = plaid_items_collection.find_one({
            "userId": user_id,
            "plaidItemId": plaid_item_id
        })
        return result
    except Exception as e:
        print(f"Error getting plaid item by ID and user ID: {e}")
        return None

#get one plaid item by MongoDB _id
def get_plaid_item_by_id_mongo(plaid_item_id):
    """Get a plaid item by MongoDB _id."""
    plaid_items_collection = get_db()["plaid_items"]

    try:
        plaid_item_id = ObjectId(plaid_item_id)
        result = plaid_items_collection.find_one({"_id": plaid_item_id})
        return result
    except Exception as e:
        print(f"Error getting plaid item by MongoDB ID: {e}")
        return None

#get one plaid item by user and institution
def get_plaid_item_by_user_and_institution(user_id, institution_id):
    """Get one plaid item by user and institution."""
    plaid_items_collection = get_db()["plaid_items"]

    try:
        user_id = ObjectId(user_id)
        result = plaid_items_collection.find_one({
            "userId": user_id,
            "institutionId": institution_id
        })
        return result
    except Exception as e:
        print(f"Error getting plaid item by user and institution: {e}")
        return None

#insert or update a plaid item for a user/institution pair
def upsert_plaid_item(user_id, institution_id, institution_name, plaid_item_id, access_token):
    """Insert or update a plaid item for a user/institution pair."""
    plaid_items_collection = get_db()["plaid_items"]

    try:
        user_id = ObjectId(user_id)
        now = utc_now()

        existing = plaid_items_collection.find_one({
            "userId": user_id,
            "institutionId": institution_id
        })

        if existing:
            item_id_changed = str(existing.get("plaidItemId", "")) != str(plaid_item_id)

            if item_id_changed:
                # New Plaid Item — old cursor belongs to the previous Item and will
                # cause "cursor not associated with access_token". Reset it and flag
                # reconnectMode so the next sync uses fingerprint-based migration
                # to avoid duplicating historical transactions.
                update_fields = {
                    "plaidItemId": plaid_item_id,
                    "accessToken": access_token,
                    "institutionName": institution_name,
                    "status": "active",
                    "cursor": "",
                    "reconnectMode": True,
                    "reconnectAt": now,
                    "updatedAt": now,
                }
            else:
                # Same Plaid Item (e.g. token refresh) — preserve the valid cursor
                update_fields = {
                    "plaidItemId": plaid_item_id,
                    "accessToken": access_token,
                    "institutionName": institution_name,
                    "status": "active",
                    "cursor": get_effective_transactions_cursor(existing),
                    "updatedAt": now,
                }

            plaid_items_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": update_fields}
            )
            return plaid_items_collection.find_one({"_id": existing["_id"]})

        new_doc = {
            "userId": user_id,
            "institutionId": institution_id,
            "institutionName": institution_name,
            "plaidItemId": plaid_item_id,
            "accessToken": access_token,
            "cursor": "",
            "status": "active",
            "createdAt": now,
            "updatedAt": now
        }

        result = plaid_items_collection.insert_one(new_doc)
        return plaid_items_collection.find_one({"_id": result.inserted_id})

    except Exception as e:
        print(f"Error upserting plaid item: {e}")
        return None


def update_plaid_item_cursor(plaid_item_id, cursor):
    """Update the Plaid transactions/sync cursor on a plaid item after a successful sync."""
    plaid_items_collection = get_db()["plaid_items"]

    try:
        plaid_item_id = ObjectId(plaid_item_id)
        now = utc_now()
        plaid_items_collection.update_one(
            {"_id": plaid_item_id},
            {"$set": {"cursor": cursor, "updatedAt": now}}
        )
        return plaid_items_collection.find_one({"_id": plaid_item_id})
    except Exception as e:
        print(f"Error updating plaid item cursor: {e}")
        return None


def reconnect_plaid_item_in_place(plaid_item_mongo_id, new_plaid_item_id, new_access_token, institution_name=None):
    """
    Credential rotation: update plaid_item in place with new Plaid credentials.
    Resets cursor to "" and sets reconnectMode=True so the first sync after
    reconnect uses fingerprint-based migration to avoid duplicating historical
    transactions. Returns updated doc or None on failure.
    """
    plaid_items_collection = get_db()["plaid_items"]
    try:
        now = utc_now()
        update = {
            "plaidItemId": new_plaid_item_id,
            "accessToken": new_access_token,
            "cursor": "",
            "reconnectMode": True,
            "reconnectAt": now,
            "status": "active",
            "updatedAt": now,
        }
        if institution_name:
            update["institutionName"] = institution_name
        plaid_items_collection.update_one(
            {"_id": ObjectId(plaid_item_mongo_id)},
            {"$set": update}
        )
        return plaid_items_collection.find_one({"_id": ObjectId(plaid_item_mongo_id)})
    except Exception as e:
        print(f"Error in reconnect_plaid_item_in_place: {e}")
        return None


def clear_reconnect_mode(plaid_item_mongo_id):
    """Clear the reconnectMode flag after a successful migration sync."""
    plaid_items_collection = get_db()["plaid_items"]
    try:
        now = utc_now()
        plaid_items_collection.update_one(
            {"_id": ObjectId(plaid_item_mongo_id)},
            {
                "$unset": {"reconnectMode": "", "reconnectAt": ""},
                "$set": {"updatedAt": now},
            }
        )
    except Exception as e:
        print(f"Error clearing reconnect mode: {e}")