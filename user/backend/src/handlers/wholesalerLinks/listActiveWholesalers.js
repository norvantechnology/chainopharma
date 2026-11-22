const { ok, fail } = require("../../shared/response");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { query } = require("../../shared/db");
const { clean, getAccountContextForUser } = require("../orders/_common");
const { parsePagination, paginationMeta } = require("./_pagination");

/**
 * GET /wholesaler-links/active-wholesalers
 * Retailer: list all approved, non-blocked wholesaler accounts (with current link status if any).
 */
async function handler(event) {
  const auth = await requirePermission(event, "WHOLESALER_LINKS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "RETAILER") {
    return fail(403, "FORBIDDEN", "Only retailers can list wholesalers.");
  }

  const qs = event?.queryStringParameters || {};
  const { page, limit, offset } = parsePagination(qs);
  const search = clean(qs.search || qs.q);

  try {
    const countParams = [];
    const countWh = [
      "r.code = 'WHOLESALER'",
      "u.status = 'APPROVED'",
      "u.is_blocked = false",
      "u.id = u.account_id"
    ];
    if (search) {
      countParams.push(`%${search}%`);
      countWh.push(
        `(u.firm_name ILIKE $1 OR u.full_name ILIKE $1 OR u.city ILIKE $1 OR u.state ILIKE $1 OR u.email ILIKE $1)`
      );
    }

    const countRes = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      WHERE ${countWh.join(" AND ")}
      `,
      countParams
    );
    const total = Number(countRes.rows?.[0]?.c || 0);

    const listParams = [perms.accountId];
    const listWh = [
      "r.code = 'WHOLESALER'",
      "u.status = 'APPROVED'",
      "u.is_blocked = false",
      "u.id = u.account_id"
    ];
    if (search) {
      listParams.push(`%${search}%`);
      listWh.push(
        `(u.firm_name ILIKE $${listParams.length} OR u.full_name ILIKE $${listParams.length} OR u.city ILIKE $${listParams.length} OR u.state ILIKE $${listParams.length} OR u.email ILIKE $${listParams.length})`
      );
    }
    listParams.push(limit);
    const limitIdx = listParams.length;
    listParams.push(offset);
    const offsetIdx = listParams.length;

    const r = await query(
      `
      SELECT
        u.id AS wholesaler_account_id,
        COALESCE(NULLIF(u.firm_name, ''), u.full_name, 'Wholesaler') AS wholesaler_name,
        u.full_name AS contact_name,
        u.email,
        u.phone_country_code,
        u.phone_number,
        u.city,
        u.state,
        u.pin_code,
        u.gst_number,
        u.address,
        l.id AS link_id,
        l.status AS link_status,
        l.requested_at,
        l.linked_at,
        l.discount_percent,
        l.credit_days,
        l.credit_limit
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN wholesaler_retailer_links l
        ON l.wholesaler_account_id = u.id
       AND l.retailer_account_id = $1
      WHERE ${listWh.join(" AND ")}
      ORDER BY wholesaler_name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      listParams
    );
    return ok({ items: r.rows || [] }, paginationMeta(page, limit, total));
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to load wholesalers.");
  }
}

module.exports = { handler };
