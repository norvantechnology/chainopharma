import { readAuth } from "../services/authStorage.js";

export function getAccessSnapshot() {
  const auth = readAuth();
  const user = auth?.user || null;
  const access = auth?.access || null;
  const perms = access?.permissions || {};
  const isOwner =
    Boolean(access?.isAccountOwner) ||
    (user?.account_id && user?.id && String(user.account_id) === String(user.id));
  const roleCode = String(access?.roleCode || user?.role || "").toUpperCase();
  return { isOwner, perms, roleCode, accessLoaded: Boolean(access) };
}

/**
 * Check resource×action from /access/me permissions payload.
 * Owners already receive role-visibility-filtered permissions from the backend,
 * so we must NOT blanket-allow all resources for owners (retailers must not get MFG, etc.).
 */
export function can(resource, action) {
  const { isOwner, perms, accessLoaded } = getAccessSnapshot();
  const r = String(resource || "").toUpperCase();
  const a = String(action || "").toUpperCase();
  if (!r || !a) return false;

  if (accessLoaded) {
    return Boolean(perms?.[r]?.[a]);
  }

  // Access not loaded yet: optimistic owner pass for bootstrap only.
  if (isOwner) return true;
  return false;
}
