from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.get("/health")
def health_check():
    """
    Simple health check endpoint.
    """
    return jsonify({"ok": True})

