/**
 * Health API client functions
 */

/**
 * Fetches the health status from the backend
 * @returns {Promise<{ok: boolean}>}
 */
export const getHealth = async () => {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};
