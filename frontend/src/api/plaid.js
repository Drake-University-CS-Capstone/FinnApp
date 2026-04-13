export const createLinkToken = async () => {
  const response = await fetch('/api/plaid/create_link_token', { method: 'POST' });
  if (!response.ok) {
    throw new Error('Could not fetch link token.');
  }
  return response.json();
};

export const setAccessToken = async (public_token) => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/plaid/set_access_token', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,   // ← add this
    },
    body: JSON.stringify({ public_token }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.display_message || 'Failed to set access token');
  }
  return response.json();
};

export const fetchTransactions = async (itemId = null) => {
  const token = localStorage.getItem('token');
  const url = itemId ? `/api/plaid/transactions?item_id=${itemId}` : '/api/plaid/transactions';
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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

/**
 * Fetch the accounts from the Plaid API.
 * @returns {Promise<any>}
 * @throws {Error} If the accounts cannot be loaded.
 */
export const fetchAccounts = async (itemId = null) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Not logged in.');
  const url = itemId ? `/api/plaid/accounts?item_id=${itemId}` : '/api/plaid/accounts';
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to load accounts.');
  return response.json();
};

export const fetchPlaidItems = async () => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Not logged in.');
  const response = await fetch('/api/plaid_items/all_ID', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error('Failed to load plaid items.');
  return response.json();
};