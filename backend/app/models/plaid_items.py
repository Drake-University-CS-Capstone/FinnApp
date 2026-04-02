from datetime import datetime, timezone
from app.extensions import get_db
from bson.objectid import ObjectId


def utc_now():
    return datetime.now(timezone.utc)



"""
This function gets all plaid items by user ID.
It takes the following parameters:
- user_id: the ID of the user who owns the Plaid items

It returns the following:
- A list of Plaid item documents
- An empty list if no plaid items are found
- An error message if the function fails
"""
def get_all_plaid_items_by_user_id(user_id):
    """Get all plaid items by user ID."""
    plaid_items_collection = get_db()["PlaidItems"]
    user_id = ObjectId(user_id)
    try:
        result = plaid_items_collection.find({"userId": user_id})
        return list(result)
    except Exception as e:
        print(f"Error getting all plaid items by user ID: {e}")
        return []



"""
This function gets a plaid item by ID and user ID.
It takes the following parameters:
- user_id: the ID of the user who owns the Plaid item
- plaid_item_id: the ID of the Plaid item

It returns the following:
- A list of Plaid item documents
- None if no plaid item is found
- An error message if the function fails
"""
def get_plaid_item_by_id_and_user_id(user_id, plaid_item_id):
    plaid_items_collection = get_db()["PlaidItems"]
    user_id = ObjectId(user_id)
    plaid_item_id = ObjectId(plaid_item_id)
    try:
        result = plaid_items_collection.find_one({"userId": user_id, "itemId": plaid_item_id})
        return list(result)
    except Exception as e:
        print(f"Error getting plaid item by ID and user ID: {e}")
        return []



