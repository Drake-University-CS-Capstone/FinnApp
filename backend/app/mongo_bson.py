"""
Helpers for values that PyMongo can BSON-encode.

Plaid's Python SDK often returns nested datetime.date objects inside dicts from
to_dict(). BSON supports datetime but not date — normalize before insert_one.
"""

from __future__ import annotations

import copy
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any


def _normalize_date(d: date) -> datetime:
    if isinstance(d, datetime):
        if d.tzinfo is None:
            return d.replace(tzinfo=timezone.utc)
        return d.astimezone(timezone.utc)
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def bson_safe(value: Any) -> Any:
    """
    Return a deep copy safe for PyMongo insert/update.

    - datetime.date -> datetime (UTC midnight)
    - datetime naive -> UTC-aware
    - Decimal -> float
    - dict / list / tuple -> recurse
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return _normalize_date(value)
    if isinstance(value, date):
        return _normalize_date(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {str(k): bson_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [bson_safe(v) for v in value]
    return copy.deepcopy(value)
