/**
 * accountClass.js
 * ================
 * Frontend mirror of backend/app/finance/accounts_classifier.py.
 *
 * The backend stamps every account with an `account_class` field, so UI code
 * should prefer that when available.  This module is the fallback: used for
 * accounts that came from older endpoints (e.g. the pre-classifier
 * /plaid/accounts/:id path still in PlaidIntegration) and for any client-side
 * filtering we want to do without a round-trip.
 *
 * Keep the buckets in sync with the Python side:
 *   cash | debt | investment | other
 */

export const ACCOUNT_CLASS = {
  CASH: 'cash',
  DEBT: 'debt',
  INVESTMENT: 'investment',
  OTHER: 'other',
};

const SUBTYPE_MAP = {
  // depository
  'depository|checking':          ACCOUNT_CLASS.CASH,
  'depository|savings':           ACCOUNT_CLASS.CASH,
  'depository|hsa':               ACCOUNT_CLASS.CASH,
  'depository|cd':                ACCOUNT_CLASS.INVESTMENT,
  'depository|money market':      ACCOUNT_CLASS.CASH,
  'depository|paypal':            ACCOUNT_CLASS.CASH,
  'depository|prepaid':           ACCOUNT_CLASS.CASH,
  'depository|cash management':   ACCOUNT_CLASS.CASH,
  'depository|ebt':               ACCOUNT_CLASS.CASH,

  // credit
  'credit|credit card':           ACCOUNT_CLASS.DEBT,
  'credit|paypal':                ACCOUNT_CLASS.DEBT,
  'credit|overdraft':             ACCOUNT_CLASS.DEBT,

  // loan (always debt)
  'loan|auto':                    ACCOUNT_CLASS.DEBT,
  'loan|business':                ACCOUNT_CLASS.DEBT,
  'loan|commercial':              ACCOUNT_CLASS.DEBT,
  'loan|construction':            ACCOUNT_CLASS.DEBT,
  'loan|consumer':                ACCOUNT_CLASS.DEBT,
  'loan|home equity':             ACCOUNT_CLASS.DEBT,
  'loan|loan':                    ACCOUNT_CLASS.DEBT,
  'loan|mortgage':                ACCOUNT_CLASS.DEBT,
  'loan|overdraft':               ACCOUNT_CLASS.DEBT,
  'loan|line of credit':          ACCOUNT_CLASS.DEBT,
  'loan|student':                 ACCOUNT_CLASS.DEBT,
  'loan|other':                   ACCOUNT_CLASS.DEBT,

  // brokerage legacy
  'brokerage|brokerage':          ACCOUNT_CLASS.INVESTMENT,
  'brokerage|cash management':    ACCOUNT_CLASS.INVESTMENT,

  // generic "other"
  'other|other asset':            ACCOUNT_CLASS.INVESTMENT,
  'other|other liability':        ACCOUNT_CLASS.DEBT,
};

const TYPE_FALLBACK = {
  depository: ACCOUNT_CLASS.CASH,
  credit:     ACCOUNT_CLASS.DEBT,
  loan:       ACCOUNT_CLASS.DEBT,
  investment: ACCOUNT_CLASS.INVESTMENT,
  brokerage:  ACCOUNT_CLASS.INVESTMENT,
  other:      ACCOUNT_CLASS.OTHER,
};

/** Normalize a Plaid/DB type or subtype string. */
function norm(v) {
  return (v || '').toString().trim().toLowerCase();
}

/**
 * Return the canonical account_class for an account-like object.
 *
 * Honors `account_class` when the backend has already stamped it; otherwise
 * falls back to (type, subtype) mapping so legacy payloads still work.
 */
export function classifyAccount(account) {
  if (!account) return ACCOUNT_CLASS.OTHER;
  if (account.account_class) return account.account_class;

  const t = norm(account.type);
  const s = norm(account.subtype);
  const key = `${t}|${s}`;
  if (SUBTYPE_MAP[key]) return SUBTYPE_MAP[key];

  // Investment is wide — trust the type alone.
  if (t === 'investment') return ACCOUNT_CLASS.INVESTMENT;

  if (TYPE_FALLBACK[t]) return TYPE_FALLBACK[t];
  return ACCOUNT_CLASS.OTHER;
}

export const isCashAccount = (a) => classifyAccount(a) === ACCOUNT_CLASS.CASH;
export const isDebtAccount = (a) => classifyAccount(a) === ACCOUNT_CLASS.DEBT;
export const isInvestmentAccount = (a) => classifyAccount(a) === ACCOUNT_CLASS.INVESTMENT;

/** Bucket an array of accounts into {cash, debt, investment, other}. */
export function groupAccounts(accounts) {
  const out = {
    [ACCOUNT_CLASS.CASH]: [],
    [ACCOUNT_CLASS.DEBT]: [],
    [ACCOUNT_CLASS.INVESTMENT]: [],
    [ACCOUNT_CLASS.OTHER]: [],
  };
  for (const a of accounts || []) {
    const klass = classifyAccount(a);
    out[klass].push({ ...a, account_class: klass });
  }
  return out;
}
