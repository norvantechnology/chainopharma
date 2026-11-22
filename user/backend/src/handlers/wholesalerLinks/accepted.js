const { ok, fail } = require("../../shared/response");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { query } = require("../../shared/db");
const { getAccountContextForUser } = require("../orders/_common");
const { parsePagination, paginationMeta } = require("./_pagination");

/**
 * GET /wholesaler-links/accepted
 * Retailer: list wholesalers that accepted the match request (status = ACTIVE).
 */
async function handler(event) {
  const auth = await requirePermission(event, "WHOLESALER_LINKS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "RETAILER") {
    return fail(403, "FORBIDDEN", "Only retailer can view accepted wholesalers.");
  }

  const qs = event?.queryStringParameters || {};
  const { page, limit, offset } = parsePagination(qs);

  try {
    const countRes = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM wholesaler_retailer_links l
      WHERE l.retailer_account_id = $1
        AND l.status = 'ACTIVE'
      `,
      [perms.accountId]
    );
    const total = Number(countRes.rows?.[0]?.c || 0);

    const r = await query(
      `
      SELECT
        l.id AS link_id,
        l.status,
        l.linked_at,
        l.credit_days,
        l.credit_limit,
        l.discount_percent,
        l.wholesaler_account_id,
        COALESCE(NULLIF(w.firm_name, ''), w.full_name, 'Wholesaler') AS wholesaler_name,
        w.full_name AS contact_name,
        w.email,
        w.phone_country_code,
        w.phone_number,
        w.city,
        w.state,
        w.pin_code,
        w.gst_number,
        w.address
      FROM wholesaler_retailer_links l
      JOIN app_users w ON w.id = l.wholesaler_account_id
      WHERE l.retailer_account_id = $1
        AND l.status = 'ACTIVE'
      ORDER BY COALESCE(l.linked_at, l.updated_at) DESC
      LIMIT $2 OFFSET $3
      `,
      [perms.accountId, limit, offset]
    );
    return ok({ items: r.rows || [] }, paginationMeta(page, limit, total));
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to load accepted wholesalers.");
  }
}

module.exports = { handler };
