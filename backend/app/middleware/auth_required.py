from functools import wraps
from flask import request, jsonify, current_app, g
import jwt
from app.extensions import decode_access_token

def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        parts = auth.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = parts[1]

        try:
            payload = decode_access_token(token, current_app.config["JWT_SECRET"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # put user id somewhere accessible in the request context
        g.user_id = payload["sub"]

        return fn(*args, **kwargs)
    return wrapper