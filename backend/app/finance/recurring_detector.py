"""
recurring_detector.py
=====================
Hybrid recurring-transaction detection.

Two sources of evidence:
  1. Plaid's `transactions/recurring/get` streams (persisted as snapshots).
  2. Our own transaction-history analysis, grouping by normalized merchant.

Both go through the same policy-driven validation so the UI only sees streams
we actually believe in.  Each validated stream is annotated with:
  - detection_source:  "plaid" | "history" | "both"
  - confidence:        integer (see RECURRING_POLICY["plaid_min_confidence"])
  - cadence:           "weekly" | "biweekly" | "monthly" | "quarterly" | ...
  - monthly_amount:    normalized to a monthly-equivalent dollar amount

Design priority: prefer false negatives.  A stream has to *earn* its way onto
the UI by clearing multiple checks; a single weak signal (e.g. is_active=True
without a believable cadence) is not enough.
"""

from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean, pstdev
from typing import Dict, Iterable, List, Optional, Tuple

from app.finance.recurring_policy import (
    RECURRING_POLICY,
    matches_any,
    merchant_on_allow_list,
    merchant_on_deny_list,
    normalize_merchant,
)


# ---------------------------------------------------------------------------
# Plaid frequency normalization
# ---------------------------------------------------------------------------
_PLAID_FREQ_TO_CADENCE = {
    "WEEKLY": "weekly",
    "BIWEEKLY": "biweekly",
    "SEMI_MONTHLY": "semimonthly",
    "SEMIMONTHLY": "semimonthly",
    "MONTHLY": "monthly",
    "ANNUALLY": "annually",
    "YEARLY": "annually",
    "QUARTERLY": "quarterly",
    "UNKNOWN": None,
}

_CADENCE_MONTHLY_MULT = {
    "weekly":      52 / 12,       # ~4.333
    "biweekly":    26 / 12,       # ~2.167
    "semimonthly": 2.0,
    "monthly":     1.0,
    "quarterly":   1 / 3,
    "annually":    1 / 12,
}


def _cadence_to_monthly_amount(amount: float, cadence: Optional[str]) -> Optional[float]:
    """
    Normalize a single-occurrence amount to a monthly-equivalent dollar figure.

    Returns None when `cadence` is unknown. The old behavior silently
    multiplied by 1.0 (i.e., treated an unknown-frequency charge as if it
    were monthly), which caused a $1,200 annual charge to be displayed as
    $1,200/month. Downstream code must handle None as "no monthly rollup
    available for this stream" and exclude the stream from monthly totals.
    """
    if amount is None:
        return None
    mult = _CADENCE_MONTHLY_MULT.get(cadence or "")
    if mult is None:
        return None
    return round(float(amount) * mult, 2)


def _parse_date(v) -> Optional[datetime]:
    """Best-effort parse of any date representation we might see."""
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    s = str(v)[:10]
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        try:
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _days_between(a: datetime, b: datetime) -> int:
    return abs((a - b).days)


def _first_category(cat) -> Optional[str]:
    if isinstance(cat, list) and cat:
        return str(cat[0])
    if isinstance(cat, str):
        return cat
    return None


def _direction_for_transaction(txn: dict) -> Optional[str]:
    """
    Canonical transaction direction used by recurring detection.

    Primary rule:
      - amount < 0  => inflow
      - amount > 0  => outflow

    Guardrail:
      Some institutions occasionally produce sign anomalies. If Plaid's
      category explicitly says INCOME, force inflow even when the sign is
      positive so payroll-like transactions cannot inflate obligations.
    """
    amount = txn.get("amount")
    if amount is None:
        return None
    try:
        amount_f = float(amount)
    except (TypeError, ValueError):
        return None

    pfc = (txn.get("personalFinanceCategory") or {}).get("primary")
    if pfc == "INCOME":
        return "in"

    # Legacy top-level category fallback for older rows.
    legacy = _first_category(txn.get("category"))
    if legacy and str(legacy).strip().lower() == "income":
        return "in"

    return "in" if amount_f < 0 else "out"


# ---------------------------------------------------------------------------
# Cadence detection from a list of occurrence dates
# ---------------------------------------------------------------------------

def _detect_cadence(dates: List[datetime]) -> Optional[Tuple[str, float]]:
    """
    Return (cadence_name, agreement_pct) or None if no cadence fits.

    We compute inter-arrival gaps (in days) between sorted occurrences, then
    pick the cadence whose target_days captures the largest share of gaps
    within tolerance.  Requires agreement >= cadence_agreement_pct.
    """
    if len(dates) < 2:
        return None

    dates_sorted = sorted(dates)
    gaps = [
        (dates_sorted[i] - dates_sorted[i - 1]).days
        for i in range(1, len(dates_sorted))
    ]
    if not gaps:
        return None

    best: Optional[Tuple[str, float]] = None
    for name, (target, tol) in RECURRING_POLICY["cadence_windows"].items():
        matches = sum(1 for g in gaps if abs(g - target) <= tol)
        pct = matches / len(gaps)
        if pct >= RECURRING_POLICY["cadence_agreement_pct"]:
            if best is None or pct > best[1]:
                best = (name, pct)
    return best


def _amount_coefficient_of_variation(amounts: List[float]) -> float:
    if len(amounts) < 2:
        return 0.0
    m = mean(amounts)
    if m == 0:
        return 0.0
    return pstdev(amounts) / abs(m)


# ---------------------------------------------------------------------------
# Plaid-stream validation
# ---------------------------------------------------------------------------

def validate_plaid_stream(stream: dict) -> Optional[dict]:
    """
    Score a single Plaid recurring stream against our policy.

    Returns a normalized dict with confidence + metadata, or None if the
    stream fails the minimum confidence bar.

    Scoring rules (see RECURRING_POLICY["plaid_min_confidence"]):
      +1 is_active == True
      +1 status is mature/early_detection
      +1 frequency maps to a known cadence
      +1 merchant_name/description is present
      +1 last occurrence within stale_days
      +1 category is in allow_categories OR cadence == monthly
      +1 merchant matches an allow-list pattern (Netflix, Spotify, rent, ...)
      -2 merchant matches deny-list pattern (airlines, bike shops, ...)
      -1 category is in deny_categories or deny_category_legacy
    """
    if not stream:
        return None

    merchant = stream.get("merchant_name") or stream.get("description") or ""
    merchant_norm = normalize_merchant(merchant)

    # --- cadence ---
    freq = str(stream.get("frequency", "")).upper()
    cadence = _PLAID_FREQ_TO_CADENCE.get(freq)

    # --- amount ---
    avg = stream.get("average_amount") or {}
    amount = avg.get("amount") if isinstance(avg, dict) else (avg or 0)
    try:
        amount = float(amount) if amount is not None else 0.0
    except (TypeError, ValueError):
        amount = 0.0

    # --- recency ---
    last_dt = _parse_date(stream.get("last_date"))
    days_since_last = (
        _days_between(datetime.now(timezone.utc), last_dt) if last_dt else None
    )

    # --- categories ---
    pfc_primary = (stream.get("personal_finance_category") or {}).get("primary")
    legacy_primary = _first_category(stream.get("category"))

    # ----- Score ---------------------------------------------------------
    confidence = 0
    reasons: List[str] = []

    if bool(stream.get("is_active", True)):
        confidence += 1
        reasons.append("is_active")

    status = str(stream.get("status", "")).upper()
    if status in ("MATURE", "EARLY_DETECTION"):
        confidence += 1
        reasons.append(f"status:{status.lower()}")

    if cadence:
        confidence += 1
        reasons.append(f"cadence:{cadence}")

    if merchant_norm:
        confidence += 1
        reasons.append("merchant_present")

    if days_since_last is not None and days_since_last <= RECURRING_POLICY["stale_days"]:
        confidence += 1
        reasons.append("recent")

    if (
        pfc_primary in RECURRING_POLICY["allow_categories"]
        or cadence == "monthly"
    ):
        confidence += 1
        reasons.append("category_allow_or_monthly")

    if merchant_on_allow_list(merchant):
        confidence += 1
        reasons.append("merchant_allow")

    if merchant_on_deny_list(merchant):
        confidence -= 2
        reasons.append("merchant_deny")

    if pfc_primary in RECURRING_POLICY["deny_categories"]:
        confidence -= 1
        reasons.append("category_deny")

    # Hard-stop transfer streams: account-to-account movement is not a bill
    # or paycheck in this UI, even if Plaid surfaces it in recurring.
    if pfc_primary in {"TRANSFER_IN", "TRANSFER_OUT"}:
        return None

    if legacy_primary and legacy_primary in RECURRING_POLICY["deny_category_legacy"]:
        confidence -= 1
        reasons.append("legacy_category_deny")

    if confidence < RECURRING_POLICY["plaid_min_confidence"]:
        return None

    return {
        "stream_id": stream.get("stream_id"),
        "merchant_name": merchant or "Unknown",
        "merchant_key": merchant_norm,
        "description": stream.get("description"),
        "category": legacy_primary,
        "personal_finance_category": pfc_primary,
        "average_amount": round(amount, 2),
        "monthly_amount": _cadence_to_monthly_amount(amount, cadence),
        "frequency": freq or None,
        "cadence": cadence,
        "is_active": bool(stream.get("is_active", True)),
        "last_date": str(stream.get("last_date")) if stream.get("last_date") else None,
        "first_date": str(stream.get("first_date")) if stream.get("first_date") else None,
        "detection_source": "plaid",
        "confidence": confidence,
        "reasons": reasons,
    }


def _direction_for_validated_stream(stream: dict, fallback_direction: str) -> str:
    """
    Normalize stream direction after validation.

    Guardrails:
      - INCOME category is always inflow.
      - TRANSFER_* is never considered recurring (already filtered earlier).
    """
    pfc = stream.get("personal_finance_category")
    if pfc == "INCOME":
        return "inflow"
    return fallback_direction


# ---------------------------------------------------------------------------
# Transaction-history fallback detector
# ---------------------------------------------------------------------------

def detect_recurring_from_transactions(transactions: Iterable[dict]) -> List[dict]:
    """
    Group transactions by normalized merchant and apply strict cadence +
    amount-variance checks.

    Input shape (from our Mongo Transactions collection; camelCase):
      {
        "merchantName": str | None,
        "name":         str,
        "amount":       float,   # positive = outflow
        "date":         datetime,
        "personalFinanceCategory": {"primary": "..."},
        "category":     [ ... ]  # legacy
      }

    Returns a list of stream dicts matching validate_plaid_stream's shape
    (detection_source="history").
    """
    # ----- bucket by merchant_key (sign-separated: inflow vs outflow) -----
    buckets: Dict[Tuple[str, str], List[dict]] = {}
    for t in transactions or []:
        raw_name = t.get("merchantName") or t.get("name") or ""
        key = normalize_merchant(raw_name)
        if not key:
            continue
        sign = _direction_for_transaction(t)
        if sign is None:
            continue
        buckets.setdefault((key, sign), []).append(t)

    results: List[dict] = []

    for (key, sign), group in buckets.items():
        if len(group) < RECURRING_POLICY["min_occurrences"]:
            continue

        # Take the most frequent merchant rendering as the display name.
        raw_names = [g.get("merchantName") or g.get("name") or "" for g in group]
        display = max(set(raw_names), key=raw_names.count) or key

        # Merchant deny-list hard-fail (airlines / bike shops etc.).
        if merchant_on_deny_list(display) and not merchant_on_allow_list(display):
            continue

        dates = [d for d in (_parse_date(g.get("date")) for g in group) if d]
        if len(dates) < RECURRING_POLICY["min_occurrences"]:
            continue

        cadence_hit = _detect_cadence(dates)
        if not cadence_hit:
            continue
        cadence_name, _agree = cadence_hit

        amounts = [abs(float(g.get("amount") or 0)) for g in group]
        cov = _amount_coefficient_of_variation(amounts)

        pfc = None
        for g in group:
            pfc_candidate = (g.get("personalFinanceCategory") or {}).get("primary")
            if pfc_candidate:
                pfc = pfc_candidate
                break
        legacy_cat = None
        # Hard-stop internal transfers. Users requested transfer activity to be
        # excluded from recurring bills/income lists.
        if pfc in {"TRANSFER_IN", "TRANSFER_OUT"}:
            continue

        for g in group:
            lc = _first_category(g.get("category"))
            if lc:
                legacy_cat = lc
                break

        # Tighter amount tolerance for subscription-ish categories, looser
        # for utility-ish categories where the amount naturally varies.
        in_allow = pfc in RECURRING_POLICY["allow_categories"]
        amount_limit = (
            RECURRING_POLICY["amount_cov_relaxed"]
            if (pfc in {"RENT_AND_UTILITIES", "MEDICAL"} or merchant_on_allow_list(display))
            else RECURRING_POLICY["amount_cov_strict"]
        )
        if cov > amount_limit and not in_allow:
            continue

        # Staleness filter.
        most_recent = max(dates)
        days_since = (datetime.now(timezone.utc) - most_recent).days
        if days_since > RECURRING_POLICY["stale_days"]:
            # Keep stale streams, but mark them inactive.
            is_active = False
        else:
            is_active = True

        # Sanity confidence score mirrors the Plaid stream shape.
        confidence = 0
        reasons: List[str] = [f"occurrences:{len(group)}", f"cov:{cov:.2f}"]
        if is_active:
            confidence += 1
            reasons.append("recent")
        confidence += 1  # cadence detected
        reasons.append(f"cadence:{cadence_name}")
        if in_allow or cadence_name == "monthly":
            confidence += 1
            reasons.append("category_allow_or_monthly")
        if merchant_on_allow_list(display):
            confidence += 1
            reasons.append("merchant_allow")
        if pfc in RECURRING_POLICY["deny_categories"]:
            confidence -= 1
            reasons.append("category_deny")

        if confidence < RECURRING_POLICY["plaid_min_confidence"] - 1:
            # Fallback detector has one less built-in check (no `status`),
            # so we allow min_confidence - 1.
            continue

        avg_amount = round(sum(amounts) / len(amounts), 2)

        results.append({
            "stream_id": f"hist:{sign}:{key}",
            "merchant_name": display or "Unknown",
            "merchant_key": key,
            "description": None,
            "category": legacy_cat,
            "personal_finance_category": pfc,
            "average_amount": avg_amount,
            "monthly_amount": _cadence_to_monthly_amount(avg_amount, cadence_name),
            "frequency": cadence_name.upper(),
            "cadence": cadence_name,
            "is_active": is_active,
            "last_date": most_recent.date().isoformat(),
            "first_date": min(dates).date().isoformat(),
            "detection_source": "history",
            "confidence": confidence,
            "reasons": reasons,
            "occurrence_count": len(group),
            "direction": "inflow" if sign == "in" else "outflow",
        })

    return results


# ---------------------------------------------------------------------------
# Merge: Plaid-validated + history-fallback
# ---------------------------------------------------------------------------

def build_recurring_view(
    plaid_snapshots: Iterable[dict],
    transactions: Iterable[dict],
) -> Dict[str, List[dict]]:
    """
    Produce the final {outflow_streams, inflow_streams, summary} payload the
    UI consumes.

    Steps:
      1. Validate Plaid streams (drop low-confidence).
      2. Run fallback detector on transaction history.
      3. Merge on normalized merchant key; when both sources hit, upgrade
         the entry to `detection_source="both"` and bump confidence by 1.
      4. Filter out inactive/stale streams for the active totals, but keep
         them in the per-side lists (marked inactive) for transparency.
    """
    # --- Step 1: validate Plaid streams ---------------------------------
    # Drop streams for which we could not normalize to a monthly amount
    # (i.e. cadence unknown). Without a monthly rollup we cannot honestly
    # show the stream on a monthly-normalized recurring view, and including
    # it at its raw `average_amount` would overstate monthly obligations.
    # This is the "prefer false negatives" rule.
    plaid_validated: List[dict] = []
    for snap in plaid_snapshots or []:
        payload = snap.get("payload") or {}
        conn_id = str(snap.get("connectionId", "")) if snap else ""
        for s in (payload.get("outflow_streams") or []):
            v = validate_plaid_stream(s)
            if v and v.get("monthly_amount") is not None:
                v["connection_id"] = conn_id
                v["direction"] = _direction_for_validated_stream(v, "outflow")
                plaid_validated.append(v)
        for s in (payload.get("inflow_streams") or []):
            v = validate_plaid_stream(s)
            if v and v.get("monthly_amount") is not None:
                v["connection_id"] = conn_id
                v["direction"] = _direction_for_validated_stream(v, "inflow")
                plaid_validated.append(v)

    # --- Step 2: run history fallback -----------------------------------
    history_streams = detect_recurring_from_transactions(transactions)

    # --- Step 3: merge --------------------------------------------------
    merged: Dict[Tuple[str, str], dict] = {}
    # Plaid first (more metadata), then overlay / supplement with history.
    for p in plaid_validated:
        k = (p.get("merchant_key") or "", p.get("direction") or "outflow")
        merged[k] = p

    for h in history_streams:
        k = (h.get("merchant_key") or "", h.get("direction") or "outflow")
        if k in merged:
            existing = merged[k]
            existing["detection_source"] = "both"
            existing["confidence"] = max(existing.get("confidence", 0), h["confidence"]) + 1
            # Fill in missing fields from history if Plaid didn't supply them.
            if not existing.get("cadence"):
                existing["cadence"] = h["cadence"]
                existing["monthly_amount"] = h["monthly_amount"]
            existing.setdefault("occurrence_count", h.get("occurrence_count"))
        else:
            merged[k] = h

    # --- Step 4: split by direction + compute summary -------------------
    outflows: List[dict] = []
    inflows: List[dict] = []
    for item in merged.values():
        if item.get("direction") == "inflow":
            inflows.append(item)
        else:
            outflows.append(item)

    outflows.sort(key=lambda x: x.get("monthly_amount", 0) or 0, reverse=True)
    inflows.sort(key=lambda x: x.get("monthly_amount", 0) or 0, reverse=True)

    # Totals intentionally ignore streams without a monthly rollup. The
    # upstream validator drops those already, but we double-guard here
    # because the merge step could overwrite monthly_amount from a
    # partner stream that also lacked cadence.
    monthly_out = sum(
        float(x["monthly_amount"])
        for x in outflows
        if x.get("is_active") and x.get("monthly_amount") is not None
    )
    monthly_in = sum(
        float(x["monthly_amount"])
        for x in inflows
        if x.get("is_active") and x.get("monthly_amount") is not None
    )

    return {
        "outflow_streams": outflows,
        "inflow_streams": inflows,
        "summary": {
            "total_monthly_outflow": round(monthly_out, 2),
            "total_monthly_inflow": round(monthly_in, 2),
            "net_recurring": round(monthly_in - monthly_out, 2),
            "outflow_count_active": sum(1 for x in outflows if x.get("is_active")),
            "inflow_count_active": sum(1 for x in inflows if x.get("is_active")),
            "source_breakdown": {
                "plaid_only": sum(1 for x in merged.values() if x.get("detection_source") == "plaid"),
                "history_only": sum(1 for x in merged.values() if x.get("detection_source") == "history"),
                "both": sum(1 for x in merged.values() if x.get("detection_source") == "both"),
            },
        },
    }
