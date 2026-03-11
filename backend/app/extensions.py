from flask_cors import CORS
from flask import current_app
from pymongo import MongoClient
import certifi
import jwt
from datetime import datetime, timedelta, timezone


cors = CORS()
_mongo_client = None


def get_db():
    global _mongo_client
    if _mongo_client is None:
        uri = current_app.config["MONGODB_URI"]
        # Use certifi CA bundle so MongoDB Atlas SSL works on macOS (avoids CERTIFICATE_VERIFY_FAILED)
        _mongo_client = MongoClient(uri, tlsCAFile=certifi.where())
    return _mongo_client[current_app.config["MONGO_DB_NAME"]]


def create_access_token(user_id: str, secret: str, expires_min: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,                      # subject = user id
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=current_app.config["JWT_EXPIRES_MIN"])).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str, secret: str) -> dict:
    # Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure
    return jwt.decode(token, secret, algorithms=["HS256"])