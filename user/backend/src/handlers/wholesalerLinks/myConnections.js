const { ok, fail } = require("../../shared/response");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { query } = require("../../shared/db");
const { clean, getAccountContextForUser } = require("../orders/_common");
const { parsePagination, paginationMeta } = require("./_pagination");

async function handler(event) {
  const auth = await requirePermission(event, "WHOLESALER_LINKS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "RETAILER") {
    return fail(403, "FORBIDDEN", "Only retailer can view this list.");
  }

  const qs = event?.queryStringParameters || {};
  const { page, limit, offset } = parsePagination(qs);
  const statusFilter = clean(qs.status).toUpperCase();
  const params = [perms.accountId];
  const wh = ["l.retailer_account_id = $1"];
  if (statusFilter) {
    if (!["PENDING", "ACTIVE", "REJECTED", "BLOCKED"].includes(statusFilter)) {
      return fail(400, "VALIDATION_ERROR", "Invalid status filter.");
    }
    params.push(statusFilter);
    wh.push(`l.status = $${params.length}`);
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
        COALESCE(NULLIF(w.firm_name, ''), w.full_name, 'Wholesaler') AS wholesaler_name,
        w.phone_country_code,
        w.phone_number,
        w.city,
        w.state
      FROM wholesaler_retailer_links l
      JOIN app_users w ON w.id = l.wholesaler_account_id
      WHERE ${whereSql}
      ORDER BY l.updated_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      listParams
    );
    return ok({ items: r.rows || [] }, paginationMeta(page, limit, total));
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to load connections.");
  }
}

module.exports = { handler };
