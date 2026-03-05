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
    email,
    password,
    first_name: firstName,
    last_name: lastName,
    phone: phoneNumber,
  };

  const response = await fetch("/api/signup", {
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

