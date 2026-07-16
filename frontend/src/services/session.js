const TOKEN_KEY = "bike-booking-tab-token";
const USER_KEY = "bike-booking-tab-user";

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveSession({ token, user }) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
