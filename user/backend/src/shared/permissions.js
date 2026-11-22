const { query } = require("./db");
const { roleVisibility, getRoleCodeForAccount } = require("./accountRoleProfile");

const RESOURCES = [
  "USERS",
  "ROLES",
  "VENDORS",
  "DIVISIONS",
  "PRODUCT_BATCHES",
  "MFG_COMPANIES",
  "PURCHASE_INVOICES",
  "PURCHASE_RETURNS",
  "VENDOR_PAYMENTS",
  "DIVISION_PAYMENTS",
  "PURCHASE_ORDERS",
  "ORDERS",
  "WHOLESALER_LINKS",
  "CUSTOMERS",
  "SALES_INVOICES",
  "SALES_RETURNS",
  "CUSTOMER_PAYMENTS",
  "PRESCRIPTIONS"
];

// Map fine-grained permission resources onto role-visibility keys.
function canonicalForRoleVisibility(resource) {
  switch (String(resource || "").trim().toUpperCase()) {
    case "MFG_COMPANIES":
    case "MANUFACTURERS":
      return "MFG_COMPANIES";
    case "DIVISIONS":
      return "DIVISIONS";
    case "DIVISION_PAYMENTS":
      return "DIVISION_PAYMENTS";
    case "VENDORS":
      return "VENDORS";
    case "PRESCRIPTIONS":
      return "PRESCRIPTIONS";
    default:
      // Visible to both WHOLESALER and RETAILER by default
      // (ORDERS, WHOLESALER_LINKS, PRODUCT_BATCHES, sales/purchase, etc.)
      return "";
  }
}

const ACTIONS = ["ADD", "VIEW", "UPDATE", "DELETE"];

function normalizeResource(v) {
  const s = String(v || "").trim().toUpperCase();
  return RESOURCES.includes(s) ? s : "";
}

function normalizeAction(v) {
  const s = String(v || "").trim().toUpperCase();
  return ACTIONS.includes(s) ? s : "";
}

function actionToColumn(action) {
  if (action === "ADD") return "can_add";
  if (action === "VIEW") return "can_view";
  if (action === "UPDATE") return "can_update";
  if (action === "DELETE") return "can_delete";
  return "";
}

async function getAccountIdForUser(userId) {
  const res = await query(`SELECT account_id FROM app_users WHERE id = $1 LIMIT 1`, [userId]);
  return res.rows[0]?.account_id || null;
}

async function getUserRoleId(userId) {
  const res = await query(`SELECT role_id FROM user_role_members WHERE user_id = $1 LIMIT 1`, [userId]);
  return res.rows[0]?.role_id || null;
}

function applyRoleVisibility(permissions, roleCode) {
  const vis = roleVisibility(roleCode);
  const out = {};
  for (const [resource, actions] of Object.entries(permissions || {})) {
    const canonical = canonicalForRoleVisibility(resource);
    if (canonical && !vis.isResourceVisible(canonical)) continue;
    out[resource] = actions;
  }
  return out;
}

async function getPermissionsForUser(userId) {
  const accountId = await getAccountIdForUser(userId);
  if (!accountId) return { accountId: null, isAccountOwner: false, permissions: {} };
  const isAccountOwner = String(accountId) === String(userId);
  const roleCode = await getRoleCodeForAccount(accountId);

  if (isAccountOwner) {
    // Owner gets full permissions by default, then role visibility hides
    // resources that don't apply (e.g. retailer never gets MFG_COMPANIES).
    const perms = {};
    for (const r of RESOURCES) {
      perms[r] = { ADD: true, VIEW: true, UPDATE: true, DELETE: true };
    }
    return { accountId, isAccountOwner, permissions: applyRoleVisibility(perms, roleCode) };
  }

  const userRoleId = await getUserRoleId(userId);
  if (!userRoleId) return { accountId, isAccountOwner: false, permissions: {} };

  const rows = await query(
    `
    SELECT resource, can_add, can_view, can_update, can_delete
    FROM user_role_permissions
    WHERE role_id = $1
    `,
    [userRoleId]
  );

  const permissions = {};
  for (const r of rows.rows || []) {
    permissions[String(r.resource).toUpperCase()] = {
      ADD: Boolean(r.can_add),
      VIEW: Boolean(r.can_view),
      UPDATE: Boolean(r.can_update),
      DELETE: Boolean(r.can_delete)
    };
  }
  return { accountId, isAccountOwner: false, permissions: applyRoleVisibility(permissions, roleCode) };
}

async function hasPermission(userId, resource, action) {
  const r = normalizeResource(resource);
  const a = normalizeAction(action);
  if (!r || !a) return false;
  const ctx = await getPermissionsForUser(userId);
  // Respect role-visibility-filtered permissions for owners too
  // (retailer owner must not access MFG_COMPANIES APIs).
  return Boolean(ctx.permissions?.[r]?.[a]);
}

module.exports = {
  RESOURCES,
  ACTIONS,
  normalizeResource,
  normalizeAction,
  actionToColumn,
  getAccountIdForUser,
  getUserRoleId,
  getPermissionsForUser,
  hasPermission,
  applyRoleVisibility,
  canonicalForRoleVisibility
};
