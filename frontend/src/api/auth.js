/**
 * Auth API client functions
 * 
 */


/**
 * Signup: maps frontend camelCase fields to backend expectations.
 * @param {{email: string, password: string, firstName: string, lastName: string, phoneNumber?: string}} payload
 * @returns {Promise<any>}
 */
export const signup = async ({ email, password, firstName, lastName, phoneNumber = "" }) => {
  const body = {
    email: (email || "").trim(),
    password: password || "",
    first_name: (firstName || "").trim(),
    last_name: (lastName || "").trim(),
    phone: (phoneNumber != null && String(phoneNumber).trim()) ? String(phoneNumber).trim() : "",
  };

  let response;
  try {
    response = await fetch("/api/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error("Could not reach server. Is the backend running on port 5000?");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || `Signup failed (${response.status})`;
    throw new Error(message);
  }

  return data;
};

/**
 * Login: maps frontend camelCase fields to backend expectations.
 * @param {{email: string, password: string}} payload
 * @returns {Promise<any>}
 */
export const login = async ({ email, password }) => {
  const body = {
    email,
    password,
  };

  const response = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error || `HTTP error! status: ${response.status}`;
    throw new Error(message);
  }
  localStorage.setItem("token", data.token);
  return data.message;
};

export const logout = async () => {
  localStorage.removeItem("token");
  return "Logged out successfully";
};

/**
 * Returns headers to send the JWT for authenticated API requests.
 * Use with fetch: { ...getAuthHeaders(), "Content-Type": "application/json" }
 * @returns {{ Authorization?: string }}
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Fetch current user (validates JWT). Use to verify token is accepted by the backend.
 * @returns {Promise<{ user_id: string, email?: string, firstName?: string, lastName?: string }>}
 */
export const getMe = async () => {
  const response = await fetch("/api/me", {
    headers: getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data.error || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data;
};

