const LS_KEY = "medico_admin_auth_v1";
const AUTH_EVENT = "medico-admin-auth-changed";

function emitAuthChanged() {
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {
    // ignore
  }
}

export function onAuthChanged(handler) {
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}

export function readAuth() {
  try {
    const raw = window.localStorage.getItem(LS_KEY) || window.sessionStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth({ rememberMe, email, accessToken, accessExpiresInSec, refreshToken }) {
  const store = rememberMe ? window.localStorage : window.sessionStorage;
  const payload = {
    email,
    accessToken,
    accessExpiresAtMs: accessExpiresInSec ? Date.now() + Number(accessExpiresInSec) * 1000 : null,
    refreshToken
  };
  store.setItem(LS_KEY, JSON.stringify(payload));
  emitAuthChanged();
}

export function saveAuthUser(user) {
  const prev = readAuth();
  const targetStore = window.localStorage.getItem(LS_KEY) ? window.localStorage : window.sessionStorage;
  targetStore.setItem(LS_KEY, JSON.stringify({ ...(prev || {}), user }));
  emitAuthChanged();
}

export function clearAuth() {
  window.localStorage.removeItem(LS_KEY);
  window.sessionStorage.removeItem(LS_KEY);
  emitAuthChanged();
}

