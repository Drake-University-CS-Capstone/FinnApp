"""
recurring_policy.py
===================
Central, tunable configuration + merchant/category normalization helpers for
the recurring-transaction detector.

Why centralize this?
--------------------
Previously the "is this recurring?" logic was implicit — the frontend trusted
whatever Plaid's `transactions/recurring/get` endpoint returned, and the
insights endpoint keyword-matched streaming services.  That produced false
positives (one-off airline and bike-shop purchases flagged as monthly bills)
and false negatives (legitimate recurring charges hidden by quirky Plaid
`is_active` flags).

This module gives us one place to tune:
  - minimum occurrence counts for fallback detection
  - cadence (weekly / biweekly / monthly / quarterly) tolerances
  - amount variance tolerances
  - Plaid-stream confidence thresholds
  - category / merchant allow/deny lists for sanity checks
  - stale-stream windows

Prefer false negatives over false positives: we'd rather miss a recurring
charge than incorrectly label a one-time purchase as a monthly subscription.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable, Optional


# ---------------------------------------------------------------------------
# Policy dataclass (kept as a plain dict for easy JSON serialization in tests)
# ---------------------------------------------------------------------------

RECURRING_POLICY = {
    # ----- Fallback detector (our own transaction-history analysis) ---------
    # Minimum occurrences before we consider something recurring at all.
    "min_occurrences": 3,

    # Cadence tolerances (in days).  A monthly charge can shift a few days
    # due to weekends, holidays, and different billing cycles; we still
    # want to accept those as "monthly".
    "cadence_windows": {
        # name:         (target_days, tolerance_days)
        "weekly":    (7,   2),
        "biweekly":  (14,  3),
        "semimonthly": (15, 3),   # 1st + 15th style payroll
        "monthly":   (30,  5),
        "quarterly": (91, 10),
    },

    # What fraction of inter-arrival gaps must match the same cadence bucket
    # for us to accept a cadence (e.g. 0.6 means 60% of gaps must be within
    # tolerance of that cadence's target_days).
    "cadence_agreement_pct": 0.6,

    # Amount variance tolerance (coefficient of variation, i.e. stdev/mean).
    # Subscription-like charges have tight amounts (CoV ~0-0.05); utilities
    # vary more (~0.1-0.3).  Above 0.40 is almost certainly not recurring.
    "amount_cov_strict": 0.10,     # for subscription-type categories
    "amount_cov_relaxed": 0.40,    # for utility-type categories

    # Staleness: if the most recent occurrence is older than this many days,
    # drop the stream from the "active" view (it's probably a cancelled sub).
    "stale_days": 75,

    # ----- Plaid-stream validation thresholds ------------------------------
    # Plaid's SDK exposes `status`, `is_active`, `frequency`, and
    # `last_amount`/`average_amount`.  We only trust a stream if it clears
    # this many checks (each worth 1 confidence point):
    #   +1  is_active == True
    #   +1  status in ("mature", "early_detection")
    #   +1  frequency is a known cadence (weekly/biweekly/monthly/…)
    #   +1  merchant_name or description resolves to a real string
    #   +1  last transaction was within stale_days
    #   +1  category is in `allow_categories` OR cadence == monthly (strongest signal)
    #   -2  merchant matches a known deny-list regex (airlines / one-off retail)
    #   -1  category is in `deny_categories`
    "plaid_min_confidence": 3,

    # ----- Category allow/deny (Plaid Personal Finance Category primary) ----
    # Strong-signal categories: recurring is expected here.
    "allow_categories": {
        "RENT_AND_UTILITIES",
        "LOAN_PAYMENTS",
        "GOVERNMENT_AND_NON_PROFIT",
        "INCOME",
        "GENERAL_SERVICES",  # insurance, subscriptions often land here
        "MEDICAL",           # insurance premiums, therapy etc.
    },

    # Soft-deny categories: almost never recurring; require strong evidence.
    "deny_categories": {
        "TRAVEL",
        "FOOD_AND_DRINK",
        "ENTERTAINMENT",
        "PERSONAL_CARE",
        "HOME_IMPROVEMENT",
        "GENERAL_MERCHANDISE",
        "TRANSFER_IN",
        "TRANSFER_OUT",
    },

    # Legacy Plaid category (top-level) heuristics for older data.
    "deny_category_legacy": {
        "Airlines and Aviation Services",
        "Airports",
        "Taxi",
        "Car Service",
        "Restaurants",
        "Food and Drink",
        "Travel",
        "Lodging",
        "Hotels and Motels",
        "Sporting Goods",
        "Electronics",
        "Bicycles",
        "Hobby and Collectibles Stores",
        "Clothing and Accessories",
        "Department Stores",
    },

    # ----- Merchant deny-list (regex, tested against normalized merchant) ---
    # Absent strong evidence these are almost certainly one-off purchases.
    # Matches are case-insensitive because we normalize before comparison.
    "merchant_deny_patterns": [
        r"\bairlines?\b",
        r"\bairways?\b",
        r"\bair\s*lines?\b",
        r"\bunited\b(?!\s*(health|healthcare))",  # United Airlines, not UnitedHealth
        r"\bdelta\b(?!\s*(dental|health))",
        r"\bsouthwest\b",
        r"\bamerican\s+airlines?\b",
        r"\bjetblue\b",
        r"\bfrontier\b",
        r"\balaska\s+air\b",
        r"\bspirit\s+air\b",
        r"\b(bike|bicycle)\s*(shop|store)?\b",
        r"\buber\b(?!\s*(eats|one))",
        r"\blyft\b",
        r"\bticketmaster\b",
        r"\bstubhub\b",
        r"\bairbnb\b",
        r"\bvrbo\b",
        r"\bhotels?\.com\b",
        r"\bbooking\.com\b",
        r"\bexpedia\b",
        r"\bbest\s+buy\b",
        r"\bhome\s+depot\b",
    ],

    # ----- Merchant allow-list (strong positive signal) --------------------
    # When a stream's merchant hits one of these we *add* confidence.
    "merchant_allow_patterns": [
        r"\bnetflix\b",
        r"\bspotify\b",
        r"\bhulu\b",
        r"\bdisney\s*\+?\b",
        r"\bhbo\b",
        r"\bmax\b",
        r"\bapple\b",
        r"\bpeacock\b",
        r"\bamazon\s+prime\b",
        r"\byoutube\s+(premium|tv|music)\b",
        r"\bnytimes?\b",
        r"\bwashington\s+post\b",
        r"\badobe\b",
        r"\bgithub\b",
        r"\bnotion\b",
        r"\bfigma\b",
        r"\bicloud\b",
        r"\bgoogle\s+(one|storage|workspace)\b",
        r"\bdropbox\b",
        r"\bverizon\b",
        r"\b(at&?t|att)\b",
        r"\bt-?mobile\b",
        r"\bcomcast\b",
        r"\bxfinity\b",
        r"\bspectrum\b",
        r"\bgeico\b",
        r"\bstate\s+farm\b",
        r"\bprogressive\b",
        r"\ballstate\b",
        r"\bnationwide\b",
        r"\bpge\b",
        r"\bcon\s*ed(ison)?\b",
        r"\bpayroll\b",
        r"\bdirect\s+dep(osit)?\b",
        r"\bmortgage\b",
        r"\brent\b",
    ],
}


# ---------------------------------------------------------------------------
# Merchant + category normalization helpers
# ---------------------------------------------------------------------------

_MERCHANT_STRIP_RE = re.compile(r"[^a-z0-9 &+.]+")
_MULTI_SPACE_RE = re.compile(r"\s+")

# Common card-feed suffixes that bloat merchant strings.  Stripped before we
# compare merchants across occurrences.
_TRAILING_JUNK_RE = re.compile(
    r"\b(?:"
    r"\d{3,}"                    # long numeric ids
    r"|#\d+"                     # reference numbers
    r"|x{2,}\d*"                 # card last-4 masks
    r"|[a-z]{2,3}\d{2,}"         # state-store codes
    r"|purchase|pos|debit|credit|auth|online|web|app|recurring|autopay"
    r")\b",
    re.IGNORECASE,
)


def normalize_merchant(raw: Optional[str]) -> str:
    """
    Produce a stable, lowercase merchant key for grouping candidates.

    Strips accents, punctuation, card-feed suffixes, and runs of whitespace.
    This is deliberately lossy so that
        "NETFLIX.COM NETFLIX.COM CA"
        "NETFLIX 123456 CA"
        "Netflix"
    all collapse to the same group key.
    """
    if not raw:
        return ""
    # Strip accents -> ASCII.
    s = unicodedata.normalize("NFKD", str(raw)).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    # Drop trailing junk like reference numbers & "PURCHASE" tags first.
    s = _TRAILING_JUNK_RE.sub(" ", s)
    # Keep letters/digits/spaces/a few symbols; drop everything else.
    s = _MERCHANT_STRIP_RE.sub(" ", s)
    s = _MULTI_SPACE_RE.sub(" ", s).strip()
    return s


def matches_any(patterns: Iterable[str], text: str) -> bool:
    """Return True if any regex in `patterns` matches `text` (case-insensitive)."""
    if not text:
        return False
    return any(re.search(p, text, flags=re.IGNORECASE) for p in patterns)


def merchant_on_deny_list(merchant_name: str) -> bool:
    """True if the (normalized) merchant looks like a one-off retail/travel charge."""
    norm = normalize_merchant(merchant_name)
    return matches_any(RECURRING_POLICY["merchant_deny_patterns"], norm)


def merchant_on_allow_list(merchant_name: str) -> bool:
    """True if the (normalized) merchant is a known recurring brand."""
    norm = normalize_merchant(merchant_name)
    return matches_any(RECURRING_POLICY["merchant_allow_patterns"], norm)
