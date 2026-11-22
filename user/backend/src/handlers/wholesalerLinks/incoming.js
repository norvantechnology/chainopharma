const { ok, fail } = require("../../shared/response");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { query } = require("../../shared/db");
const { clean, getAccountContextForUser } = require("../orders/_common");
const { parsePagination, paginationMeta } = require("./_pagination");

/**
 * GET /wholesaler-links/incoming
 * Wholesaler: list match requests (default PENDING; optional status filter).
 */
async function handler(event) {
  const auth = await requirePermission(event, "WHOLESALER_LINKS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "WHOLESALER") {
    return fail(403, "FORBIDDEN", "Only wholesaler can view incoming match requests.");
  }

  const qs = event?.queryStringParameters || {};
  const { page, limit, offset } = parsePagination(qs);
  const statusFilter = clean(qs.status).toUpperCase();
  const params = [perms.accountId];
  const wh = ["l.wholesaler_account_id = $1"];
  if (statusFilter) {
    if (!["PENDING", "ACTIVE", "REJECTED", "BLOCKED"].includes(statusFilter)) {
      return fail(400, "VALIDATION_ERROR", "Invalid status filter.");
    }
    params.push(statusFilter);
    wh.push(`l.status = $${params.length}`);
  } else {
    wh.push(`l.status = 'PENDING'`);
  }
  const whereSql = wh.join(" AND ");

  try {
    const countRes = await query(
      `SELECT COUNT(*)::int AS c FROM wholesaler_retailer_links l WHERE ${whereSql}`,
      params
    );
    const total = Number(countRes.rows?.[0]?.c || 0);

    const listParams = [...params, limit, offset];
    const limitIdx = listParams.length - 1;
    const offsetIdx = listParams.length;

    const r = await query(
      `
      SELECT
        l.*,
        COALESCE(NULLIF(rt.firm_name, ''), rt.full_name, 'Retailer') AS retailer_name,
        rt.full_name AS retailer_contact_name,
        rt.email AS retailer_email,
        rt.phone_country_code AS retailer_phone_country_code,
        rt.phone_number AS retailer_phone_number,
        rt.city AS retailer_city,
        rt.state AS retailer_state,
        rt.gst_number AS retailer_gst_number,
        rt.address AS retailer_address
      FROM wholesaler_retailer_links l
      JOIN app_users rt ON rt.id = l.retailer_account_id
      WHERE ${whereSql}
      ORDER BY COALESCE(l.requested_at, l.created_at) DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      listParams
    );
    return ok({ items: r.rows || [] }, paginationMeta(page, limit, total));
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to load incoming match requests.");
  }
}

module.exports = { handler };
