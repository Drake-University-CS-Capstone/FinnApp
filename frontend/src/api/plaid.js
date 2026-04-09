export const createLinkToken = async () => {
  const response = await fetch('/api/plaid/create_link_token', { method: 'POST' });
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
  const token = localStorage.getItem('token');
  const response = await fetch('/api/plaid/transactions', {
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
export const fetchAccounts = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not logged in.');
  }
  const response = await fetch('/api/plaid/accounts', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to load accounts.');
  }
  return response.json();
};