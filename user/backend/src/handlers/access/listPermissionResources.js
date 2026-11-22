const { ok } = require("../../shared/response");
const { query } = require("../../shared/db");
const { requireApprovedUser } = require("../../shared/auth");
const { getAccountIdForUser } = require("../../shared/permissions");
const { getRoleCodeForAccount, normalizeRoleCode, roleVisibility } = require("../../shared/accountRoleProfile");

// Returns the canonical list of permission resources that roles can be
// assigned permissions for. Frontend should render the roles UI from
// this list instead of hardcoding resource names.
async function handler(event) {
  const auth = await requireApprovedUser(event);
  if (!auth.ok) return auth.resp;

  const userId = String(auth.claims?.sub || "");
  const accountId = (await getAccountIdForUser(userId)) || userId;
  const tokenRoleRaw = String(auth.claims?.role || "").trim();
  const roleCode = tokenRoleRaw
    ? normalizeRoleCode(tokenRoleRaw)
    : await getRoleCodeForAccount(accountId);
  const vis = roleVisibility(roleCode);

  const res = await query(
    `
    SELECT
      resource,
      COALESCE(display_name, resource)  AS display_name,
      COALESCE(description, '')         AS description,
      COALESCE(sort_order, 100)         AS sort_order
    FROM permission_resources
    ORDER BY COALESCE(sort_order, 100), resource
    `
  );

  const resources = (res.rows || []).filter((x) => vis.isResourceVisible(x.resource));
  return ok({ roleCode, resources });
}

module.exports = { handler };
