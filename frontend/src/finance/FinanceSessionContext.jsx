import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  connectBank,
  createLinkToken,
  createReconnectLinkToken,
  reconnectBank,
  syncTransactions,
} from '../api/plaid';
import { fetchPlaidItems } from '../api/plaidItems';
import { fetchAccounts } from '../api/accounts';
import { fetchTransactionsByDateRange } from '../api/transactions';
import {
  fetchCashflow,
  fetchInsights,
  fetchInvestmentTransactions,
  fetchInvestmentsHoldings,
  fetchInvestmentsSummary,
  fetchLiabilitiesSummary,
  fetchNetWorth,
  fetchRecurringOverview,
  syncExtendedAll,
} from '../api/plaidExtended';
import {
  buildFinanceModel,
  DEFAULT_LEDGER_DAYS,
  DEFAULT_PERIOD_DAYS,
  resolveTransactionRange,
} from './financeModel';

const FinanceSessionContext = createContext(null);

const LEDGER_FETCH_LIMIT = 5000;
const EXTENDED_AUTO_SYNC_STALE_MS = 12 * 60 * 60 * 1000;
const EXTENDED_AUTO_SYNC_SESSION_KEY = 'finance.extendedAutoSyncAttempted';
const EXTENDED_LAST_SYNC_AT_KEY = 'finance.extendedLastSyncAt';

function getStoredExtendedSyncAt() {
  if (typeof window === 'undefined') return 0;
  const value = Number(window.localStorage.getItem(EXTENDED_LAST_SYNC_AT_KEY));
  return Number.isFinite(value) ? value : 0;
}

function markExtendedSyncCompleted() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EXTENDED_LAST_SYNC_AT_KEY, String(Date.now()));
}

function buildConnectionInstitutionMap(plaidItems) {
  const map = {};
  for (const item of plaidItems || []) {
    if (item?._id != null) {
      map[String(item._id)] = item.institutionName || 'Bank';
    }
  }
  return map;
}

function firstCategory(category) {
  if (Array.isArray(category) && category.length > 0) return category[0];
  if (typeof category === 'string') return category;
  return null;
}

function workspaceSelection(plaidItems) {
  if ((plaidItems || []).length === 1) {
    return { _id: 'ALL', institutionName: plaidItems[0]?.institutionName || 'Linked account' };
  }
  return { _id: 'ALL', institutionName: 'All linked accounts' };
}

function buildDateRange(days) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
}

function formatAccountForWorkspace(dbAcct, institutionByConnectionId) {
  const connId = dbAcct.connectionId != null ? String(dbAcct.connectionId) : null;
  const institutionName = connId ? institutionByConnectionId?.[connId] : undefined;

  return {
    account_id: dbAcct._id,
    connection_id: connId,
    plaid_account_id: dbAcct.plaidAccountId,
    name: dbAcct.name,
    official_name: dbAcct.officialName,
    type: dbAcct.type,
    subtype: dbAcct.subtype,
    account_class: dbAcct.account_class,
    mask: dbAcct.mask,
    institution_name: institutionName,
    holder_category: dbAcct.holderCategory || null,
    is_active: typeof dbAcct.isActive === 'boolean' ? dbAcct.isActive : null,
    created_at: dbAcct.createdAt || null,
    updated_at: dbAcct.updatedAt || null,
    balances: {
      available: dbAcct.availableBalance,
      current: dbAcct.currentBalance,
      limit: dbAcct.limit,
      iso_currency_code: dbAcct.isoCurrencyCode || 'USD',
      unofficial_currency_code: dbAcct.unofficialCurrencyCode || null,
    },
  };
}

function formatTransactionForWorkspace(dbTxn, institutionByConnectionId, accountById) {
  const connId = dbTxn.connectionId != null ? String(dbTxn.connectionId) : null;
  const institutionName = connId ? institutionByConnectionId?.[connId] : undefined;
  const account = accountById?.[String(dbTxn.accountId)] || null;
  const pfc = dbTxn.personalFinanceCategory || null;

  return {
    transaction_id: dbTxn._id,
    connection_id: connId,
    account_id: dbTxn.accountId,
    account_name: account?.name || account?.official_name || 'Account',
    account_mask: account?.mask || null,
    name: dbTxn.merchantName || dbTxn.name,
    merchant_name: dbTxn.merchantName || dbTxn.name,
    amount: Number(dbTxn.amount) || 0,
    date: dbTxn.date ? String(dbTxn.date).slice(0, 10) : null,
    iso_currency_code: dbTxn.isoCurrencyCode || 'USD',
    payment_channel: dbTxn.paymentChannel,
    category: pfc?.primary || null,
    category_detailed: pfc?.detailed || null,
    category_raw: firstCategory(dbTxn.category),
    personalFinanceCategory: pfc,
    institution_name: institutionName || account?.institution_name,
    pending: Boolean(dbTxn.pending),
  };
}

export function FinanceSessionProvider({ children }) {
  const [phase, setPhase] = useState('loading');
  const [plaidItems, setPlaidItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);

  const [linkToken, setLinkToken] = useState(null);
  const [linkError, setLinkError] = useState(null);

  const [reconnectToken, setReconnectToken] = useState(null);
  const [reauthItem, setReauthItem] = useState(null);

  const [insightsData, setInsightsData] = useState(null);
  const [recurringData, setRecurringData] = useState(null);
  const [liabilitiesData, setLiabilitiesData] = useState(null);
  const [investmentsSummary, setInvestmentsSummary] = useState(null);
  const [investmentsHoldings, setInvestmentsHoldings] = useState(null);
  const [investmentsTx, setInvestmentsTx] = useState(null);
  const [netWorthData, setNetWorthData] = useState(null);
  const [cashflowData, setCashflowData] = useState(null);
  const [extendedLoading, setExtendedLoading] = useState(false);
  const [extendedSyncing, setExtendedSyncing] = useState(false);
  const [transactionRange, setTransactionRange] = useState({
    preset: '30D',
    customStart: null,
    customEnd: null,
  });
  const autoExtendedSyncStarted = useRef(false);

  const loadExtendedData = useCallback(async () => {
    setExtendedLoading(true);
    try {
      const [ins, rec, liab, invSum, invHold, invTx, nw, cf] = await Promise.allSettled([
        fetchInsights(),
        fetchRecurringOverview(),
        fetchLiabilitiesSummary(),
        fetchInvestmentsSummary(),
        fetchInvestmentsHoldings(),
        fetchInvestmentTransactions(),
        fetchNetWorth(),
        fetchCashflow({ days: DEFAULT_PERIOD_DAYS }),
      ]);

      if (ins.status === 'fulfilled') setInsightsData(ins.value);
      if (rec.status === 'fulfilled') setRecurringData(rec.value);
      if (liab.status === 'fulfilled') setLiabilitiesData(liab.value);
      if (invSum.status === 'fulfilled') setInvestmentsSummary(invSum.value);
      if (invHold.status === 'fulfilled') setInvestmentsHoldings(invHold.value);
      if (invTx.status === 'fulfilled') setInvestmentsTx(invTx.value);
      if (nw.status === 'fulfilled') setNetWorthData(nw.value);
      if (cf.status === 'fulfilled') setCashflowData(cf.value);
    } catch (err) {
      console.error('Failed to load extended data:', err);
    } finally {
      setExtendedLoading(false);
    }
  }, []);

  const maybeAutoSyncExtended = useCallback(async (itemsOverride = plaidItems) => {
    const items = Array.isArray(itemsOverride) ? itemsOverride : [];
    if (!items.length || autoExtendedSyncStarted.current || typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(EXTENDED_AUTO_SYNC_SESSION_KEY) === '1') return;

    const lastSyncAt = getStoredExtendedSyncAt();
    const isStale = !lastSyncAt || (Date.now() - lastSyncAt) > EXTENDED_AUTO_SYNC_STALE_MS;
    if (!isStale) return;

    autoExtendedSyncStarted.current = true;
    window.sessionStorage.setItem(EXTENDED_AUTO_SYNC_SESSION_KEY, '1');
    setExtendedSyncing(true);
    try {
      await syncExtendedAll(items);
      await loadExtendedData();
      markExtendedSyncCompleted();
    } catch (err) {
      console.error('Background extended sync error:', err);
    } finally {
      setExtendedSyncing(false);
    }
  }, [loadExtendedData, plaidItems]);

  const initPlaidLink = useCallback(() => {
    createLinkToken()
      .then((data) => setLinkToken(data.link_token))
      .catch((err) => setLinkError(err.message));
  }, []);

  const initReconnectLink = useCallback((item) => {
    setReauthItem(item);
    createReconnectLinkToken(item._id)
      .then((data) => setReconnectToken(data.link_token))
      .catch((err) => {
        console.error('Could not create reconnect token:', err);
        setError(err.message || 'Could not initiate re-authentication.');
        setPhase('error');
      });
  }, []);

  const loadWorkspaceData = useCallback(async (itemsOverride = plaidItems) => {
    const { startDate, endDate } = buildDateRange(DEFAULT_LEDGER_DAYS);
    const institutionByConnectionId = buildConnectionInstitutionMap(itemsOverride);
    const [accountResponse, transactionResponse] = await Promise.all([
      fetchAccounts().then((res) => res.accounts || []).catch(() => []),
      fetchTransactionsByDateRange({
        startDate,
        endDate,
        limit: LEDGER_FETCH_LIMIT,
      }).then((res) => res.transactions || []),
    ]);

    const formattedAccounts = accountResponse.map((account) =>
      formatAccountForWorkspace(account, institutionByConnectionId),
    );
    const accountById = Object.fromEntries(
      formattedAccounts.map((account) => [String(account.account_id), account]),
    );
    const formattedTransactions = transactionResponse.map((tx) =>
      formatTransactionForWorkspace(tx, institutionByConnectionId, accountById),
    );

    setAccounts(formattedAccounts);
    setTransactions(formattedTransactions);
    setSelectedItem(workspaceSelection(itemsOverride));
    setPhase('dashboard');
    await loadExtendedData();
    void maybeAutoSyncExtended(itemsOverride);
  }, [plaidItems, loadExtendedData, maybeAutoSyncExtended]);

  const loadDashboardData = useCallback(async (item) => {
    setPhase('syncing');
    setError(null);

    try {
      await syncTransactions(item._id);
    } catch (err) {
      if (err.requiresReauth) {
        initReconnectLink(item);
        setPhase('reauth');
        return;
      }
      console.error('Sync error:', err);
    }

    try {
      const freshItems = await fetchPlaidItems().catch(() => plaidItems);
      const normalized = Array.isArray(freshItems) ? freshItems : plaidItems;
      setPlaidItems(normalized);
      await loadWorkspaceData(normalized);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
      setError(err.message || 'Failed to load your financial data.');
      setPhase('error');
    }
  }, [initReconnectLink, loadWorkspaceData, plaidItems]);

  const loadDashboardDataAll = useCallback(async () => {
    setPhase('syncing');
    setError(null);

    try {
      await Promise.all(
        (plaidItems || []).map((item) =>
          syncTransactions(item._id).catch((err) => {
            console.error('Sync error:', item?._id, err);
          }),
        ),
      );
    } catch (err) {
      console.error('Sync all error:', err);
    }

    try {
      const freshItems = await fetchPlaidItems().catch(() => plaidItems);
      const normalized = Array.isArray(freshItems) ? freshItems : plaidItems;
      setPlaidItems(normalized);
      await loadWorkspaceData(normalized);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
      setError(err.message || 'Failed to load your financial data.');
      setPhase('error');
    }
  }, [loadWorkspaceData, plaidItems]);

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    setPhase('syncing');
    try {
      const result = await connectBank({
        publicToken,
        institutionId: metadata.institution.institution_id,
        institutionName: metadata.institution.name,
      });
      if (result?.plaidItem?._id) {
        await syncTransactions(result.plaidItem._id).catch((err) => {
          console.error('Initial sync failed for new bank:', err);
        });
      }
      const fresh = await fetchPlaidItems().catch(() => []);
      const normalized = Array.isArray(fresh) ? fresh : [];
      setPlaidItems(normalized);
      await loadWorkspaceData(normalized);
    } catch (err) {
      console.error('Connect failed:', err);
      setError(err.message || 'Failed to connect bank.');
      setPhase('error');
    }
  }, [loadWorkspaceData]);

  const onReconnectSuccess = useCallback(async (publicToken) => {
    if (!reauthItem) return;
    setPhase('syncing');
    try {
      await reconnectBank(reauthItem._id, publicToken);
      await syncTransactions(reauthItem._id).catch((err) => {
        console.error('Post-reauth sync failed:', err);
      });
      const freshItems = await fetchPlaidItems().catch(() => plaidItems);
      const normalized = Array.isArray(freshItems) ? freshItems : plaidItems;
      setPlaidItems(normalized);
      await loadWorkspaceData(normalized);
    } catch (err) {
      console.error('Reconnect failed:', err);
      if (err.requiresManualReconciliation) {
        setError('Account mapping is ambiguous — manual reconciliation needed. Please contact support.');
      } else {
        setError(err.message || 'Reconnect failed.');
      }
      setPhase('error');
    }
  }, [reauthItem, loadWorkspaceData, plaidItems]);

  const handleAddNewBank = useCallback(() => {
    if (!linkToken) initPlaidLink();
    setPhase('link');
  }, [initPlaidLink, linkToken]);

  const handleBackToBanks = useCallback(() => {
    setPhase((plaidItems || []).length > 0 ? 'select_bank' : 'link');
  }, [plaidItems]);

  const handleSyncExtended = useCallback(async () => {
    setExtendedSyncing(true);
    try {
      if ((plaidItems || []).length > 0) {
        await syncExtendedAll(plaidItems);
      }
      await loadExtendedData();
      markExtendedSyncCompleted();
    } catch (err) {
      console.error('Extended sync error:', err);
    } finally {
      setExtendedSyncing(false);
    }
  }, [loadExtendedData, plaidItems]);

  const refreshPlaidItems = useCallback(() => (
    fetchPlaidItems()
      .then((items) => {
        const normalized = Array.isArray(items) ? items : [];
        setPlaidItems(normalized);
        return normalized;
      })
      .catch((err) => {
        console.error('Failed to refresh plaid items:', err);
        throw err;
      })
  ), []);

  const setTransactionRangePreset = useCallback((preset) => {
    setTransactionRange((prev) => ({
      ...prev,
      preset,
    }));
  }, []);

  const setTransactionCustomRange = useCallback((customStart, customEnd) => {
    setTransactionRange({
      preset: 'CUSTOM',
      customStart: customStart || null,
      customEnd: customEnd || null,
    });
  }, []);

  const resetTransactionRange = useCallback(() => {
    setTransactionRange({
      preset: '30D',
      customStart: null,
      customEnd: null,
    });
  }, []);

  const bootOnce = useRef(false);
  useEffect(() => {
    if (bootOnce.current) return;
    bootOnce.current = true;

    fetchPlaidItems()
      .then((items) => {
        const normalized = Array.isArray(items) ? items : [];
        setPlaidItems(normalized);
        if (normalized.length > 0) {
          setPhase('select_bank');
        } else {
          initPlaidLink();
          setPhase('link');
        }
      })
      .catch((err) => {
        console.error('Failed to check plaid items:', err);
        initPlaidLink();
        setPhase('link');
      });
  }, [initPlaidLink]);

  const financeModel = useMemo(() => buildFinanceModel({
    accounts,
    transactions,
    recurringData,
    liabilitiesData,
    investmentsSummary,
    netWorthData,
    cashflowData,
    insightsData,
    periodDays: DEFAULT_PERIOD_DAYS,
  }), [
    accounts,
    transactions,
    recurringData,
    liabilitiesData,
    investmentsSummary,
    netWorthData,
    cashflowData,
    insightsData,
  ]);

  const transactionRangeResolved = useMemo(
    () => resolveTransactionRange(transactionRange),
    [transactionRange],
  );

  const value = useMemo(() => ({
    phase,
    setPhase,
    plaidItems,
    setPlaidItems,
    selectedItem,
    accounts,
    transactions,
    error,
    setError,
    linkToken,
    setLinkToken,
    linkError,
    setLinkError,
    reconnectToken,
    setReconnectToken,
    reauthItem,
    setReauthItem,
    initPlaidLink,
    initReconnectLink,
    loadDashboardData,
    loadDashboardDataAll,
    onPlaidSuccess,
    onReconnectSuccess,
    handleAddNewBank,
    handleBackToBanks,
    refreshPlaidItems,
    insightsData,
    recurringData,
    liabilitiesData,
    investmentsSummary,
    investmentsHoldings,
    investmentsTx,
    netWorthData,
    cashflowData,
    extendedLoading,
    extendedSyncing,
    loadExtendedData,
    handleSyncExtended,
    financeModel,
    workspaceLabel: selectedItem?.institutionName || 'All linked accounts',
    cashflowPeriodDays: DEFAULT_PERIOD_DAYS,
    transactionRange,
    transactionRangeResolved,
    setTransactionRange,
    setTransactionRangePreset,
    setTransactionCustomRange,
    resetTransactionRange,
  }), [
    phase,
    plaidItems,
    selectedItem,
    accounts,
    transactions,
    error,
    linkToken,
    linkError,
    reconnectToken,
    reauthItem,
    initPlaidLink,
    initReconnectLink,
    loadDashboardData,
    loadDashboardDataAll,
    onPlaidSuccess,
    onReconnectSuccess,
    handleAddNewBank,
    handleBackToBanks,
    refreshPlaidItems,
    insightsData,
    recurringData,
    liabilitiesData,
    investmentsSummary,
    investmentsHoldings,
    investmentsTx,
    netWorthData,
    cashflowData,
    extendedLoading,
    extendedSyncing,
    loadExtendedData,
    handleSyncExtended,
    financeModel,
    selectedItem,
    transactionRange,
    transactionRangeResolved,
    setTransactionRangePreset,
    setTransactionCustomRange,
    resetTransactionRange,
  ]);

  return (
    <FinanceSessionContext.Provider value={value}>
      {children}
    </FinanceSessionContext.Provider>
  );
}

export function useFinanceSession() {
  const ctx = useContext(FinanceSessionContext);
  if (!ctx) {
    throw new Error('useFinanceSession must be used within FinanceSessionProvider');
  }
  return ctx;
}
