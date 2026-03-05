from flask import Blueprint, request, jsonify, current_app, g
from bson import ObjectId
from app.extensions import get_db, create_access_token
from app.models.user import hash_password, build_user_doc, validate_password, check_password
from app.middleware.auth_required import auth_required


users_bp = Blueprint("users", __name__, url_prefix="/api")


@users_bp.post("/signup")
def signup():
    """
    Create a new user. Expects JSON: { "email": "...", "password": "..." }.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400
    if not first_name:
        return jsonify({"error": "First name is required"}), 400
    if not last_name:
        return jsonify({"error": "Last name is required"}), 400
    if not validate_password(password):
        return jsonify({"error": "Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character"}), 400

    db = get_db()
    users = db["Users"]
    normalized_email = email.lower()

    if users.find_one({"email": normalized_email}):
        return jsonify({"error": "An account with this email already exists"}), 409

    password_hash = hash_password(password)
    user_doc = build_user_doc(normalized_email, password_hash, first_name=first_name, last_name=last_name, phone=phone)
    users.insert_one(user_doc)

    return jsonify({
        "message": f"Account created, Welcome {first_name} {last_name}!",
    }), 201


@users_bp.post("/login")
def login():
    """TODO: verify password and return a session/JWT."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400

    db = get_db()
    users = db["Users"]

    user = users.find_one({"email": email.lower()})
    if not user or not user.get("passwordHash"):
        return jsonify({"error": "Invalid email or password"}), 401

    if not check_password(password, user["passwordHash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(
    str(user["_id"]),
    current_app.config["JWT_SECRET"],
    current_app.config["JWT_EXPIRES_MIN"],
    )
    return jsonify({"message": "Login successful", "token": token}), 200


@users_bp.get("/me")
@auth_required
def me():
    """Return current user info (requires Authorization: Bearer <token>)."""
    db = get_db()
    users = db["Users"]
    user = users.find_one({"_id": ObjectId(g.user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id": str(user["_id"]),
        "email": user.get("email"),
        "firstName": user.get("firstName"),
        "lastName": user.get("lastName"),
    }), 200