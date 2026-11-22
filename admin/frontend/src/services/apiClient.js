const DEFAULT_BASE_URL = "http://localhost:4005";
import { emitApiToastFromResponse } from "./toastBus.js";
import { readAuth, clearAuth } from "./authStorage.js";

export function getApiBaseUrl() {
  const base = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;
  return String(base).replace(/\/+$/, "");
}

export async function apiGet(path, opts) {
  const base = `${getApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const params = opts?.params && typeof opts.params === "object" ? opts.params : null;
  const qs = params
    ? new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && String(v) !== "")
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : "";
  const url = qs ? `${base}?${qs}` : base;
  const auth = readAuth();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {})
    }
  });
  const json = await res.json().catch(() => null);
  const resp = { status: res.status, json };
  if (res.status === 401) clearAuth();
  const toastMode = opts?.toast ?? "auto";
  if (toastMode !== "none") emitApiToastFromResponse(resp);
  return resp;
}

export async function apiPost(path, body, opts) {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const auth = readAuth();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {})
    },
    body: JSON.stringify(body || {})
  });
  const json = await res.json().catch(() => null);
  const resp = { status: res.status, json };
  if (res.status === 401) clearAuth();
  const toastMode = opts?.toast ?? "auto";
  if (toastMode !== "none") emitApiToastFromResponse(resp);
  return resp;
}

export async function apiPatch(path, body, opts) {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const auth = readAuth();
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {})
    },
    body: JSON.stringify(body || {})
  });
  const json = await res.json().catch(() => null);
  const resp = { status: res.status, json };
  if (res.status === 401) clearAuth();
  const toastMode = opts?.toast ?? "auto";
  if (toastMode !== "none") emitApiToastFromResponse(resp);
  return resp;
}

export async function apiPut(path, body, opts) {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const auth = readAuth();
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {})
    },
    body: JSON.stringify(body || {})
  });
  const json = await res.json().catch(() => null);
  const resp = { status: res.status, json };
  if (res.status === 401) clearAuth();
  const toastMode = opts?.toast ?? "auto";
  if (toastMode !== "none") emitApiToastFromResponse(resp);
  return resp;
}

export async function apiDelete(path, opts) {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const auth = readAuth();
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      accept: "application/json",
      ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {})
    }
  });
  const json = await res.json().catch(() => null);
  const resp = { status: res.status, json };
  if (res.status === 401) clearAuth();
  const toastMode = opts?.toast ?? "auto";
  if (toastMode !== "none") emitApiToastFromResponse(resp);
  return resp;
}

