const TOKEN_KEY = "ma_token";
const USER_KEY = "ma_user";
const MOBILE_KEY = "ma_mobile";
const DEFAULT_TIMEOUT_MS = 8000;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function saveMobile(m) {
  localStorage.setItem(MOBILE_KEY, m);
}
export function getSavedMobile() {
  return localStorage.getItem(MOBILE_KEY) || "";
}
export function clearSavedMobile() {
  localStorage.removeItem(MOBILE_KEY);
}

// Thrown only when the server actually responded with a non-OK HTTP status.
// Timeouts and network failures throw a plain Error instead, so callers can tell
// "server said no" apart from "server never answered".
export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpError(e) {
  return e instanceof HttpError;
}

export async function api(path, { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (e) {
    if (e && (e.name === "AbortError" || e.name === "TimeoutError")) {
      throw new Error("Server timeout — try again");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(data.error || `Request failed (${res.status})`, res.status);
  return data;
}
