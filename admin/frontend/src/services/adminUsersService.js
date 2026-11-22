import { apiDelete, apiGet, apiPatch } from "./apiClient.js";

function q(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function listUsers({ search, role, status, userType, blocked, sortBy, sortDir, limit, offset } = {}) {
  return apiGet(`/admin/users${q({ search, roleId: role, status, userType, blocked, sortBy, sortDir, limit, offset })}`);
}

export function getUserDetails(id) {
  return apiGet(`/admin/users/${encodeURIComponent(id)}`);
}

export function updateUser(id, body) {
  return apiPatch(`/admin/users/${encodeURIComponent(id)}`, body, { toast: "auto" });
}

export function updateUserStatus(id, status) {
  return apiPatch(`/admin/users/${encodeURIComponent(id)}/status`, { status }, { toast: "auto" });
}

export function deleteUser(id) {
  return apiDelete(`/admin/users/${encodeURIComponent(id)}`, { toast: "auto" });
}

