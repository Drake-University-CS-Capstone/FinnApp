from datetime import datetime, timezone
from app.extensions import get_db

def utc_now():
    return datetime.now(timezone.utc)

