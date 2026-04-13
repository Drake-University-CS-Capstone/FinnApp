import { getAuthHeaders } from "./auth";

const BASE = "/api/accounts";

/**
 * @param {string} path
 * @param {Record<string, string | number | undefined | null>} [params]
 */
function buildUrl(path, params) {
  const url = new URL(path, "http://_");
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }
  return `${BASE}${url.pathname}${url.search}`;
}

async function handleJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

/**
 * @returns {Promise<{ accounts: any[] }>}
 */
export const fetchAccounts = async () => {
  const response = await fetch(`${BASE}/`, {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * @param {string} connectionId
 * @returns {Promise<{ accounts: any[] }>}
 */
export const fetchAccountsByConnection = async (connectionId) => {
  const response = await fetch(buildUrl("/by_connection", { connection_id: connectionId }), {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * @param {string} accountId
 * @returns {Promise<any>}
 */
export const fetchAccountById = async (accountId) => {
  const response = await fetch(`${BASE}/${encodeURIComponent(accountId)}`, {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * @param {Record<string, unknown>} body
 * @returns {Promise<any>}
 */
export const createAccount = async (body) => {
  const response = await fetch(`${BASE}/`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleJson(response);
};

/**
 * @param {string} accountId
 * @param {{ availableBalance?: number | null, currentBalance?: number | null, limit?: number | null }} balances
 * @returns {Promise<any>}
 */
export const updateAccountBalances = async (accountId, balances) => {
  const response = await fetch(`${BASE}/${encodeURIComponent(accountId)}/balances`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(balances),
  });
  return handleJson(response);
};

/**
 * @param {string} accountId
 * @returns {Promise<any>}
 */
export const deactivateAccount = async (accountId) => {
  const response = await fetch(`${BASE}/${encodeURIComponent(accountId)}/deactivate`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};
