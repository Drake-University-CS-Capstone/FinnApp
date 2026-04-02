from datetime import datetime, timezone
from app.extensions import get_db
from bson import ObjectId


def utc_now():
    return datetime.now(timezone.utc)

#get all plaid items by user ID
def get_all_plaid_items_by_user_id(user_id):
    """Get all plaid items by user ID."""
    plaid_items_collection = get_db()["PlaidItems"]

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
    plaid_items_collection = get_db()["PlaidItems"]

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
    plaid_items_collection = get_db()["PlaidItems"]

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
    plaid_items_collection = get_db()["PlaidItems"]

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
    plaid_items_collection = get_db()["PlaidItems"]

    try:
        user_id = ObjectId(user_id)
        now = utc_now()

        existing = plaid_items_collection.find_one({
            "userId": user_id,
            "institutionId": institution_id
        })

        if existing:
            plaid_items_collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "plaidItemId": plaid_item_id,
                        "accessToken": access_token,
                        "institutionName": institution_name,
                        "status": "active",
                        "updatedAt": now
                    }
                }
            )
            return plaid_items_collection.find_one({"_id": existing["_id"]})

        new_doc = {
            "userId": user_id,
            "institutionId": institution_id,
            "institutionName": institution_name,
            "plaidItemId": plaid_item_id,
            "accessToken": access_token,
            "status": "active",
            "createdAt": now,
            "updatedAt": now
        }

        result = plaid_items_collection.insert_one(new_doc)
        return plaid_items_collection.find_one({"_id": result.inserted_id})

    except Exception as e:
        print(f"Error upserting plaid item: {e}")
        return None