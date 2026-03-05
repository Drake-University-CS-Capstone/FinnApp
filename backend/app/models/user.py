"""
User helpers for MongoDB: password hashing and document shape.
"""
import bcrypt
from datetime import datetime, timezone


def hash_password(password: str) -> str:
    """Return a bcrypt hash of the password (storable in DB)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def validate_password(password: str) -> bool:
    if len(password) < 8:
        return False

    has_upper = has_lower = has_digit = has_special = False

    for char in password:
        if char.isspace():
            return False   # reject passwords with spaces
        if char.isupper():
            has_upper = True
        elif char.islower():
            has_lower = True
        elif char.isdigit():
            has_digit = True
        elif not char.isalnum():
            has_special = True

        if has_upper and has_lower and has_digit and has_special:
            return True

    return False

def check_password(password: str, password_hash: str) -> bool:
    """Return True if password matches the stored hash."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def build_user_doc(email: str, password_hash: str, first_name: str, last_name: str, phone: str = "", **extra) -> dict:
    """Build a user document for the users collection (camelCase keys to match schema)."""
    now = datetime.now(timezone.utc)
    doc = {
        "email": email.strip().lower(),
        "passwordHash": password_hash,
        "firstName": first_name,
        "lastName": last_name,
        "createdAt": now
    }
    if phone:
        doc["phone"] = phone
    doc.update(extra)
    return doc
