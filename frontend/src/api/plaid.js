import { getAuthHeaders } from "./auth";

export const createLinkToken = async () => {
  const response = await fetch('/api/plaid/create_link_token', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Could not fetch link token.');
  }
  return response.json();
};

export const setAccessToken = async (public_token) => {
  const response = await fetch('/api/plaid/set_access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_token }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.display_message || 'Failed to set access token');
  }
  return response.json();
};

export const fetchTransactions = async () => {
  const response = await fetch('/api/plaid/transactions', {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to load transactions.');
  return response.json();
};

export const fetchBalances = async () => {
  const response = await fetch('/api/plaid/balance');
  if (!response.ok) {
    throw new Error('Failed to load balances.');
  }
  return response.json();
};

export const fetchAccounts = async () => {
  const response = await fetch('/api/plaid/accounts', {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to load accounts.');
  }
  return response.json();
};

/**
 * First-time bank connection: exchange public token, persist plaid_item + accounts + initial sync.
 * @param {{ publicToken: string, institutionId: string, institutionName: string }} params
 */
export const connectBank = async ({ publicToken, institutionId, institutionName }) => {
  const response = await fetch('/api/plaid/connect', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      public_token: publicToken,
      institution_id: institutionId,
      institution_name: institutionName,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to connect bank.');
  }
  return data;
};

/**
 * Create a Plaid link token in update mode for credential rotation (reconnect).
 * @param {string} plaidItemMongoId - Mongo _id of the plaid_item to reconnect
 * @returns {Promise<{ link_token: string }>}
 */
export const createReconnectLinkToken = async (plaidItemMongoId) => {
  const response = await fetch('/api/plaid/create_reconnect_token', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plaid_item_mongo_id: plaidItemMongoId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Could not fetch reconnect link token.');
  }
  return data;
};

/**
 * Complete a reconnect after update-mode Link: rotates credentials, remaps
 * accounts in place, and runs migration sync.
 * @param {string} plaidItemMongoId - Mongo _id of the plaid_item
 * @param {string} publicToken - New public token from Plaid Link onSuccess
 */
export const reconnectBank = async (plaidItemMongoId, publicToken) => {
  const response = await fetch(`/api/plaid/reconnect/${encodeURIComponent(plaidItemMongoId)}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public_token: publicToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || 'Reconnect failed.');
    if (data.requiresManualReconciliation) err.requiresManualReconciliation = true;
    throw err;
  }
  return data;
};

/**
 * Sync transactions for a stored plaid_item using its DB access token + cursor.
 * @param {string} plaidItemId - Mongo _id of the plaid_item
 */
export const syncTransactions = async (plaidItemId) => {
  const response = await fetch(`/api/plaid/sync/${encodeURIComponent(plaidItemId)}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (data.requiresReauth) {
      const err = new Error(data.error || 'Bank connection needs re-authentication');
      err.requiresReauth = true;
      throw err;
    }
    throw new Error(data.error || 'Sync failed.');
  }
  return data;
};
