import { getAuthHeaders } from "./auth";

const BASE = "/api/transactions";

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

/**
 * @param {{ limit?: number, skip?: number }} [opts]
 */
function paginationParams(opts) {
  if (!opts) return {};
  const out = {};
  if (opts.limit != null) out.limit = opts.limit;
  if (opts.skip != null) out.skip = opts.skip;
  return out;
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
 * @param {Record<string, unknown>} body
 * @returns {Promise<any>}
 */
export const createTransaction = async (body) => {
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
 * @param {{ limit?: number, skip?: number }} [opts]
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchTransactions = async (opts) => {
  const response = await fetch(buildUrl("/", paginationParams(opts)), {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * @param {string} transactionId
 * @returns {Promise<any>}
 */
export const fetchTransactionById = async (transactionId) => {
  const response = await fetch(`${BASE}/${encodeURIComponent(transactionId)}`, {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * @param {string} accountId
 * @param {{ limit?: number, skip?: number }} [opts]
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchTransactionsByAccount = async (accountId, opts) => {
  const response = await fetch(
    buildUrl("/by_account", {
      account_id: accountId,
      ...paginationParams(opts),
    }),
    { headers: getAuthHeaders() }
  );
  return handleJson(response);
};

/**
 * @param {string} connectionId
 * @param {{ limit?: number, skip?: number }} [opts]
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchTransactionsByConnection = async (connectionId, opts) => {
  const response = await fetch(
    buildUrl("/by_connection", {
      connection_id: connectionId,
      ...paginationParams(opts),
    }),
    { headers: getAuthHeaders() }
  );
  return handleJson(response);
};

/**
 * @param {{ startDate: string, endDate: string, connectionId?: string, limit?: number, skip?: number }} range
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchTransactionsByDateRange = async (range) => {
  const params = {
    start_date: range.startDate,
    end_date: range.endDate,
    ...paginationParams({ limit: range.limit, skip: range.skip }),
  };
  if (range.connectionId) {
    params.connection_id = range.connectionId;
  }
  const response = await fetch(buildUrl("/by_date_range", params), {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * @param {{ minAmount: number, maxAmount: number, limit?: number, skip?: number }} range
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchTransactionsByAmountRange = async (range) => {
  const response = await fetch(
    buildUrl("/by_amount_range", {
      min_amount: range.minAmount,
      max_amount: range.maxAmount,
      ...paginationParams({ limit: range.limit, skip: range.skip }),
    }),
    { headers: getAuthHeaders() }
  );
  return handleJson(response);
};

/**
 * @param {string} category
 * @param {{ limit?: number, skip?: number }} [opts]
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchTransactionsByCategory = async (category, opts) => {
  const response = await fetch(
    buildUrl("/by_category", {
      category,
      ...paginationParams(opts),
    }),
    { headers: getAuthHeaders() }
  );
  return handleJson(response);
};

/**
 * @param {string} merchantName
 * @param {{ limit?: number, skip?: number }} [opts]
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchTransactionsByMerchant = async (merchantName, opts) => {
  const response = await fetch(
    buildUrl("/by_merchant", {
      merchant_name: merchantName,
      ...paginationParams(opts),
    }),
    { headers: getAuthHeaders() }
  );
  return handleJson(response);
};

/**
 * @param {string} transactionType
 * @param {{ limit?: number, skip?: number }} [opts]
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchTransactionsByType = async (transactionType, opts) => {
  const response = await fetch(
    buildUrl("/by_type", {
      transaction_type: transactionType,
      ...paginationParams(opts),
    }),
    { headers: getAuthHeaders() }
  );
  return handleJson(response);
};

/**
 * @param {{ limit?: number, skip?: number }} [opts]
 * @returns {Promise<{ transactions: any[] }>}
 */
export const fetchPendingTransactions = async (opts) => {
  const response = await fetch(buildUrl("/pending", paginationParams(opts)), {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};
