from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from app.middleware.auth_required import auth_required
from app.models.plaid_items import get_all_plaid_items_by_user_id, get_plaid_item_by_id_and_user_id, get_plaid_item_by_id_mongo, get_plaid_item_by_user_and_institution, upsert_plaid_item


plaid_items_bp = Blueprint("plaid_items", __name__, url_prefix="/api/plaid_items")


def _serialize(doc):
    """Convert ObjectId and datetime fields so jsonify can handle them."""
    if doc is None:
        return None
    doc = dict(doc)
    for key in ("_id", "userId"):
        if key in doc and isinstance(doc[key], ObjectId):
            doc[key] = str(doc[key])
    for key in ("createdAt", "updatedAt"):
        if key in doc and doc[key] is not None:
            doc[key] = doc[key].isoformat()
    return doc

#Route for getting all plaid items by user ID
@plaid_items_bp.get("/all_ID")
@auth_required
def get_all_plaid_items_by_user_id_route():
    """Get all plaid items by user ID."""
    user_id = g.user_id
    plaid_items = get_all_plaid_items_by_user_id(user_id)
    if plaid_items:
        return jsonify([_serialize(item) for item in plaid_items]), 200
    else:
        return jsonify({"error": "No plaid items found for user ID: " + user_id}), 404

#Route for getting a plaid item by ID + plaid item ID (temp ID)
@plaid_items_bp.get("/all_Item_User")
@auth_required
def get_plaid_item_by_id_and_user_id_route():
    """Get a plaid item by ID and user ID."""
    user_id = g.user_id
    plaid_item_id = request.args.get("plaid_item_id")
    plaid_item = get_plaid_item_by_id_and_user_id(user_id, plaid_item_id)
    if plaid_item:
        return jsonify(_serialize(plaid_item)), 200
    else:
        return jsonify({"error": "No plaid item found for user ID: " + user_id + " and plaid item ID: " + plaid_item_id}), 404

##Reoute for getting a plaid item by _id (MongoDB ID)
@plaid_items_bp.get("/all_Item_User_ID")
@auth_required
def get_plaid_item_by_id_and_user_id_route():
    """Get a plaid item by ID and user ID."""
    user_id = g.user_id
    plaid_item_id = request.args.get("plaid_item_id")
    plaid_item = get_plaid_item_by_id_mongo(user_id, plaid_item_id)
    if plaid_item:
        return jsonify(_serialize(plaid_item)), 200
    else:
        return jsonify({"error": "No plaid item found for user ID: " + user_id + " and plaid item ID: " + plaid_item_id}), 404

#Route for getting a plaid item by user + institution
@plaid_items_bp.get("/all_Item_User_Institution")
@auth_required
def get_plaid_item_by_user_and_institution_route():
    """Get a plaid item by user and institution."""
    user_id = g.user_id
    institution_id = request.args.get("institution_id")
    plaid_item = get_plaid_item_by_user_and_institution(user_id, institution_id)
    if plaid_item:
        return jsonify(_serialize(plaid_item)), 200
    else:
        return jsonify({"error": "No plaid item found for user ID: " + user_id + " and institution ID: " + institution_id}), 404

#Route for updating a plaid item access token, item ID, and cursor
@plaid_items_bp.put("/update_Item_User_Institution")
@auth_required
def update_plaid_item_by_user_and_institution_route():
    """Update a plaid item access token, item ID, and cursor."""
    user_id = g.user_id
    institution_id = request.args.get("institution_id")
    plaid_item_id = request.args.get("plaid_item_id")
    access_token = request.args.get("access_token")
    institution_name = request.args.get("institution_name")

    plaid_item = upsert_plaid_item(user_id, institution_id, institution_name, plaid_item_id, access_token)
    if plaid_item:
        return jsonify(_serialize(plaid_item)), 200
    else:
        return jsonify({"error": "No plaid item found for user ID: " + user_id + " and institution ID: " + institution_id}), 404