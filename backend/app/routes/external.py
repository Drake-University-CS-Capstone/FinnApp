"""
Example route that uses an external API service.

This shows how to call external APIs from your Flask routes.
"""

from flask import Blueprint, jsonify, request
from app.services.example_api import call_external_api

external_bp = Blueprint("external", __name__, url_prefix="/api")


@external_bp.get("/external-example")
def external_example():
    """
    Example endpoint that calls an external API.
    
    Usage:
        GET /api/external-example?url=https://api.github.com/users/octocat
    """
    url = request.args.get("url")
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    # Call the external API via your service
    result = call_external_api(url)
    
    if result is None:
        return jsonify({"error": "Failed to fetch from external API"}), 500
    
    return jsonify({"data": result})
