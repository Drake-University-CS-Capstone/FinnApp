import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

export default function PlaidIntegration() {
  const [linkToken, setLinkToken] = useState(null);
  const [isLinked, setIsLinked] = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch the link_token from your Flask backend when the component loads
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await fetch('/api/plaid/create_link_token', { method: 'POST' });
        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (err) {
        console.error('Error fetching link token:', err);
        setError('Could not fetch link token.');
      }
    };
    fetchLinkToken();
  }, []);

  // 2. Handle a successful login through Plaid Link
  const onSuccess = useCallback(async (public_token, metadata) => {
    console.log('Success! Public Token:', public_token);
    try {
      // Send the public_token to your backend to exchange for an access_token
      const response = await fetch('/api/plaid/set_access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      
      if (response.ok) {
        setIsLinked(true);
      } else {
        const errData = await response.json();
        setError(errData.error?.display_message || 'Failed to set access token');
      }
    } catch (err) {
      console.error('Error exchanging token:', err);
      setError('Token exchange failed.');
    }
  }, []);

  // 3. Initialize the Plaid Link hook
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  // 4. Fetch transactions once linked
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/plaid/transactions');
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to fetch transactions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Plaid Sandbox Integration</h2>
      
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!isLinked ? (
        <div>
          <p>Status: Not Linked</p>
          <button 
            onClick={() => open()} 
            disabled={!ready || !linkToken}
            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
          >
            Link Bank Account
          </button>
        </div>
      ) : (
        <div>
          <p style={{ color: 'green', fontWeight: 'bold' }}>Status: Linked successfully!</p>
          <button 
            onClick={fetchTransactions}
            disabled={loading}
            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', marginBottom: '20px' }}
          >
            {loading ? 'Fetching...' : 'Get Transactions'}
          </button>

          {transactions && (
            <div style={{ background: '#f4f4f4', padding: '15px', borderRadius: '5px' }}>
              <h3>Transactions JSON</h3>
              <pre style={{ overflowX: 'auto' }}>
                {JSON.stringify(transactions, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}