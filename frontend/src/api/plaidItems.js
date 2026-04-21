import { getAuthHeaders } from "./auth";

const BASE = "/api/plaid_items";

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
 * All Plaid items for the logged-in user.
 * @returns {Promise<any[]>}
 */
export const fetchPlaidItems = async () => {
  const response = await fetch(buildUrl("/all_ID"), {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * By Plaid's string item id (not Mongo _id).
 * @param {string} plaidItemId
 * @returns {Promise<any>}
 */
export const fetchPlaidItemByPlaidId = async (plaidItemId) => {
  const response = await fetch(buildUrl("/all_Item_User", { plaid_item_id: plaidItemId }), {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * By MongoDB document _id for the plaid item.
 * @param {string} plaidItemMongoId
 * @returns {Promise<any>}
 */
export const fetchPlaidItemByMongoId = async (plaidItemMongoId) => {
  const response = await fetch(buildUrl("/all_Item_User_ID", { plaid_item_id: plaidItemMongoId }), {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * @param {string} institutionId
 * @returns {Promise<any>}
 */
export const fetchPlaidItemByInstitution = async (institutionId) => {
  const response = await fetch(buildUrl("/all_Item_User_Institution", { institution_id: institutionId }), {
    headers: getAuthHeaders(),
  });
  return handleJson(response);
};

/**
 * Upsert a plaid item (query params only).
 * @param {{ institutionId: string, plaidItemId: string, accessToken: string, institutionName?: string }} params
 * @returns {Promise<any>}
 */
export const upsertPlaidItem = async ({
  institutionId,
  plaidItemId,
  accessToken,
  institutionName,
}) => {
  const response = await fetch(
    buildUrl("/update_Item_User_Institution", {
      institution_id: institutionId,
      plaid_item_id: plaidItemId,
      access_token: accessToken,
      institution_name: institutionName,
    }),
    {
      method: "PUT",
      headers: getAuthHeaders(),
    }
  );
  return handleJson(response);
};
