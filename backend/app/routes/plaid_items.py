from flask import Blueprint, request, jsonify, current_app, g
from bson import ObjectId
from app.extensions import get_db, create_access_token
from app.models.user import hash_password, build_user_doc, validate_password, check_password
from app.middleware.auth_required import auth_required
from app.models.plaid_items import get_all_plaid_items_by_user_id


#Blueprint
plaid_items_bp = Blueprint("plaid_items", __name__, url_prefix="/api/plaid_items")

#Route for getting all plaid items by user ID
@plaid_items_bp.get("/all_ID")
@auth_required
def get_all_plaid_items_by_user_id_route():
    """Get all plaid items by user ID."""
    user_id = g.user_id
    plaid_items = get_all_plaid_items_by_user_id(user_id)
    if plaid_items:
        return jsonify(plaid_items), 200
    else:
        return jsonify({"error": "No plaid items found for user ID: " + user_id}), 404

#Route for getting a plaid item by ID + user ID
@plaid_items_bp.get("/all_Item_User")
@auth_required
def get_plaid_item_by_id_and_user_id_route():
    """Get a plaid item by ID and user ID."""
    user_id = g.user_id
    plaid_item_id = request.args.get("plaid_item_id")
    plaid_item = get_plaid_item_by_id_and_user_id(user_id, plaid_item_id)
    if plaid_item:
        return jsonify(plaid_item), 200
    else:
        return jsonify({"error": "No plaid item found for user ID: " + user_id + " and plaid item ID: " + plaid_item_id}), 404