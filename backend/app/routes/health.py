from flask import Blueprint, jsonify
from app.extensions import get_db
health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.get("/health")
def health_check():
    """
    Simple health check endpoint.
    """
    return jsonify({"ok": True})

#Test route for MongoDB connection
@health_bp.get("/mongodb-test")
def mongodb_test():
    """
    Test route for MongoDB connection.
    """
    db = get_db()
    collections = db.list_collection_names()
    if "Users" in collections:
        return jsonify({"ok": True, "message": "MongoDB connection successful"})
    else:
        return jsonify({"ok": False, "message": "MongoDB connection failed"})

    
    