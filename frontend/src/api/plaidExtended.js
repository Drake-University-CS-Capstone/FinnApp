import { getAuthHeaders } from "./auth";

const BASE = "/api/plaid_extended";

/** Sync all extended Plaid products for a single item. */
export const syncExtended = async (plaidItemMongoId) => {
  const response = await fetch(`${BASE}/sync/${encodeURIComponent(plaidItemMongoId)}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Extended sync failed.");
  return data;
};

/** Sync extended products for all of the user's items. */
export const syncExtendedAll = async (plaidItems) => {
  return Promise.allSettled(
    (plaidItems || []).map((item) => syncExtended(item._id))
  );
};

/** Recurring cashflow streams across all connections. */
export const fetchRecurringOverview = async () => {
  const response = await fetch(`${BASE}/recurring/overview`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to load recurring overview.");
  return data;
};

/** Aggregated liabilities (credit cards, student loans, mortgages). */
export const fetchLiabilitiesSummary = async () => {
  const response = await fetch(`${BASE}/liabilities/summary`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to load liabilities.");
  return data;
};

/** High-level investments summary (total value, allocation, top holdings). */
export const fetchInvestmentsSummary = async () => {
  const response = await fetch(`${BASE}/investments/summary`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to load investments summary.");
  return data;
};

/** Full holdings list with security detail joined in. */
export const fetchInvestmentsHoldings = async () => {
  const response = await fetch(`${BASE}/investments/holdings`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to load holdings.");
  return data;
};

/** Recent investment transactions (buys/sells/dividends). */
export const fetchInvestmentTransactions = async () => {
  const response = await fetch(`${BASE}/investments/transactions`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to load investment transactions.");
  return data;
};

/** Computed financial insights + nudges. */
export const fetchInsights = async () => {
  const response = await fetch(`${BASE}/insights`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to load insights.");
  return data;
};

/** Aggregate net worth across all connections. */
export const fetchNetWorth = async () => {
  const response = await fetch(`${BASE}/net_worth`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to load net worth.");
  return data;
};

/** Canonical period cashflow (income / spending / net over the last N days). */
export const fetchCashflow = async ({ days = 30 } = {}) => {
  const qs = new URLSearchParams({ days: String(days) }).toString();
  const response = await fetch(`${BASE}/cashflow?${qs}`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to load cashflow.");
  return data;
};
