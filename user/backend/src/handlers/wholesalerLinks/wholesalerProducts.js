const { ok, fail } = require("../../shared/response");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { query } = require("../../shared/db");
const { clean, getAccountContextForUser } = require("../orders/_common");
const { parsePagination, paginationMeta } = require("./_pagination");

/**
 * GET /wholesaler-links/{wholesalerAccountId}/products
 * Retailer: list all non-deleted products of an ACTIVE wholesaler (no catalog layer).
 */
async function handler(event) {
  const auth = await requirePermission(event, "WHOLESALER_LINKS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "RETAILER") {
    return fail(403, "FORBIDDEN", "Only retailer can view wholesaler products.");
  }

  const wholesalerAccountId = clean(
    event?.pathParameters?.wholesalerAccountId || event?.pathParameters?.id
  );
  if (!wholesalerAccountId) {
    return fail(400, "VALIDATION_ERROR", "wholesalerAccountId is required.");
  }

  const qs = event?.queryStringParameters || {};
  const { page, limit, offset } = parsePagination(qs);
  const search = clean(qs.search || qs.q);

  try {
    const linkRes = await query(
      `
      SELECT id, status, discount_percent, credit_days, credit_limit, wholesaler_account_id
      FROM wholesaler_retailer_links
      WHERE wholesaler_account_id = $1
        AND retailer_account_id = $2
        AND status = 'ACTIVE'
      LIMIT 1
      `,
      [wholesalerAccountId, perms.accountId]
    );
    const link = linkRes.rows?.[0];
    if (!link) {
      return fail(
        403,
        "NOT_CONNECTED",
        "You must have an accepted connection with this wholesaler."
      );
    }

    const baseFilters = ["p.account_id = $1", "p.deleted_at IS NULL"];
    const filterParams = [wholesalerAccountId];
    if (search) {
      filterParams.push(`%${search}%`);
      baseFilters.push(
        `(p.name ILIKE $2 OR p.code ILIKE $2 OR COALESCE(p.drug_name, '') ILIKE $2)`
      );
    }
    const whereSql = baseFilters.join(" AND ");

    const countRes = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM products p
      WHERE ${whereSql}
      `,
      filterParams
    );
    const total = Number(countRes.rows?.[0]?.c || 0);

    const listParams = [wholesalerAccountId, link.discount_percent];
    const listFilters = ["p.account_id = $1", "p.deleted_at IS NULL"];
    if (search) {
      listParams.push(`%${search}%`);
      listFilters.push(
        `(p.name ILIKE $3 OR p.code ILIKE $3 OR COALESCE(p.drug_name, '') ILIKE $3)`
      );
    }
    listParams.push(limit);
    const limitIdx = listParams.length;
    listParams.push(offset);
    const offsetIdx = listParams.length;

    const r = await query(
      `
      WITH stock AS (
        SELECT product_id, COALESCE(SUM(current_stock), 0)::numeric(14,3) AS current_stock
        FROM product_batches
        WHERE account_id = $1
          AND deleted_at IS NULL
        GROUP BY product_id
      ),
      rate AS (
        SELECT DISTINCT ON (product_id)
          product_id,
          sales_rate,
          mrp
        FROM product_batches
        WHERE account_id = $1
          AND deleted_at IS NULL
        ORDER BY product_id, expiry_date ASC NULLS LAST, created_at DESC
      )
      SELECT
        p.id AS product_id,
        p.id,
        p.account_id AS wholesaler_account_id,
        p.code AS product_code,
        p.name AS product_name,
        p.drug_name,
        p.packing,
        COALESCE(rate.sales_rate, rate.mrp, 0)::numeric(14,4) AS sales_rate,
        COALESCE(rate.sales_rate, rate.mrp, 0)::numeric(14,4) AS unit_price,
        rate.mrp,
        1 AS min_order_qty,
        NULL::numeric AS max_order_qty,
        p.sales_gst,
        COALESCE(stock.current_stock, 0) AS current_stock,
        $2::numeric AS retailer_discount_percent
      FROM products p
      LEFT JOIN stock ON stock.product_id = p.id
      LEFT JOIN rate ON rate.product_id = p.id
      WHERE ${listFilters.join(" AND ")}
      ORDER BY p.name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      listParams
    );

    return ok(
      {
        link: {
          id: link.id,
          status: link.status,
          wholesaler_account_id: link.wholesaler_account_id,
          discount_percent: link.discount_percent,
          credit_days: link.credit_days,
          credit_limit: link.credit_limit
        },
        items: r.rows || []
      },
      paginationMeta(page, limit, total)
    );
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to load wholesaler products.");
  }
}

module.exports = { handler };
