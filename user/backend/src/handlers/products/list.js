const { ok, fail } = require("../../shared/response");
const { query } = require("../../shared/db");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { getAccountContextForUser } = require("../orders/_common");
const { parseWholesalerIds, invalidWholesalerIds } = require("../../shared/parseWholesalerIds");

function clean(v) {
  return String(v ?? "").trim();
}

/**
 * Parse wholesaler id list from query.
 * Accepts comma-separated or repeated query keys / multiValue params.
 */
function wantsWholesalerCatalog(qs = {}) {
  const source = clean(qs.source || qs.mode).toLowerCase();
  if (
    source === "wholesaler_products" ||
    source === "wholesaler_catalog" ||
    source === "marketplace" ||
    source === "wholesaler"
  ) {
    return true;
  }
  const flag = clean(qs.wholesaler_catalog || qs.marketplace || qs.all_wholesalers || "");
  if (["1", "true", "yes"].includes(flag.toLowerCase())) return true;
  return (
    qs.wholesaler_ids != null ||
    qs.wholesalerIds != null ||
    qs.wholesaler_account_ids != null ||
    qs.wholesalerAccountIds != null ||
    qs.wholesaler_id != null ||
    qs.wholesalerId != null ||
    qs.wholesaler_account_id != null ||
    qs.wholesalerAccountId != null
  );
}

async function requireAnyPermission(event, pairs) {
  let last = null;
  for (const [resource, action] of pairs) {
    const auth = await requirePermission(event, resource, action);
    if (auth.ok) return auth;
    last = auth;
  }
  return last || { ok: false, resp: fail(403, "FORBIDDEN", "Permission denied.") };
}

async function listOwnProducts(event, ctx) {
  const qs = event?.queryStringParameters || {};
  const page = Math.max(1, Number(qs.page) || 1);
  const limit = Math.min(500, Math.max(1, Number(qs.limit) || 50));
  const offset = (page - 1) * limit;
  const search = clean(qs.search || qs.q);
  const mfgCompanyId = clean(qs.mfg_company_id || qs.mfgCompanyId);
  const divisionId = clean(qs.division_id || qs.divisionId);
  const requireActiveBatchRaw = clean(qs.require_active_batch || qs.requireActiveBatch || "");
  const requireActiveBatch =
    requireActiveBatchRaw === "1" ||
    requireActiveBatchRaw.toLowerCase() === "true" ||
    requireActiveBatchRaw.toLowerCase() === "yes";
  const sortBy = clean(qs.sort_by || qs.sortBy || "name");
  const sortOrder = clean(qs.sort_order || qs.sortOrder || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
  const allowedSort = new Set([
    "name",
    "code",
    "created_at",
    "updated_at",
    "total_quantity",
    "active_batch_count",
    "low_batch_count"
  ]);
  const orderBy = allowedSort.has(sortBy) ? sortBy : "name";

  const wh = ["p.account_id = $1", "p.deleted_at IS NULL"];
  const ps = [ctx.accountId];
  if (search) {
    ps.push(`%${search}%`);
    wh.push(
      `(p.code ILIKE $${ps.length} OR p.name ILIKE $${ps.length} OR COALESCE(p.drug_name,'') ILIKE $${ps.length})`
    );
  }
  if (mfgCompanyId) {
    ps.push(mfgCompanyId);
    wh.push(`p.mfg_company_id = $${ps.length}`);
  }
  if (divisionId) {
    ps.push(divisionId);
    wh.push(`p.division_id = $${ps.length}`);
  }
  if (requireActiveBatch) {
    wh.push(`EXISTS (
      SELECT 1 FROM product_batches pb
      WHERE pb.account_id = p.account_id
        AND pb.product_id = p.id
        AND pb.deleted_at IS NULL
    )`);
  }
  const whereSql = `WHERE ${wh.join(" AND ")}`;

  const cnt = await query(`SELECT COUNT(*)::int AS c FROM products p ${whereSql}`, ps);
  const total = Number(cnt.rows?.[0]?.c || 0);
  const rows = await query(
    `
    WITH batch_stock AS (
      SELECT
        pb.account_id,
        pb.product_id,
        COUNT(*)::int AS active_batch_count,
        COALESCE(SUM(COALESCE(st.qty, 0) + COALESCE(st.free_qty, 0)), 0)::numeric(12,3) AS total_quantity,
        COUNT(*) FILTER (
          WHERE COALESCE(pb.low_stock_alert_enabled, false)
            AND (COALESCE(st.qty, 0) + COALESCE(st.free_qty, 0)) <= COALESCE(pb.low_stock_threshold, 0)
        )::int AS low_batch_count
      FROM product_batches pb
      LEFT JOIN (
        SELECT batch_id, SUM(COALESCE(qty,0))::numeric(12,3) AS qty, SUM(COALESCE(free_qty,0))::numeric(12,3) AS free_qty
        FROM inventory_txns
        WHERE account_id = $1
        GROUP BY batch_id
      ) st ON st.batch_id = pb.id
      WHERE pb.account_id = $1
        AND pb.deleted_at IS NULL
      GROUP BY pb.account_id, pb.product_id
    )
    SELECT
      p.*,
      m.code AS mfg_company_code,
      m.name AS mfg_company_name,
      m.short_name AS mfg_short_name,
      COALESCE(m.purchase_order_lock, false) AS mfg_purchase_order_lock,
      COALESCE(m.sale_lock, false) AS mfg_sale_lock,
      COALESCE(m.prevent_discount, false) AS mfg_prevent_discount,
      COALESCE(m.prevent_free_qty, false) AS mfg_prevent_free_qty,
      COALESCE(m.prevent_net_rate, false) AS mfg_prevent_net_rate,
      d.name AS division_name,
      d.code AS division_code,
      COALESCE(d.is_active, true) AS division_is_active,
      COALESCE(bs.active_batch_count, 0)::int AS active_batch_count,
      COALESCE(bs.total_quantity, 0)::numeric(12,3) AS total_quantity,
      COALESCE(bs.low_batch_count, 0)::int AS low_batch_count,
      (
        COALESCE(p.low_stock_alert_enabled, false)
        AND COALESCE(bs.total_quantity, 0) <= COALESCE(p.low_stock_threshold, 0)
      ) AS product_low_stock
    FROM products p
    LEFT JOIN mfg_companies m
      ON m.id = p.mfg_company_id
     AND m.account_id = p.account_id
     AND m.deleted_at IS NULL
    LEFT JOIN divisions d
      ON d.id = p.division_id
     AND d.account_id = p.account_id
     AND d.deleted_at IS NULL
    LEFT JOIN batch_stock bs
      ON bs.account_id = p.account_id
     AND bs.product_id = p.id
    ${whereSql}
    ORDER BY ${orderBy} ${sortOrder}
    LIMIT $${ps.length + 1} OFFSET $${ps.length + 2}
    `,
    [...ps, limit, offset]
  );
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return ok({
    items: rows.rows || [],
    filter: { source: "own" },
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1
    }
  });
}

async function listWholesalerMarketplaceProducts(event, ctx) {
  const qs = event?.queryStringParameters || {};
  const multi = event?.multiValueQueryStringParameters || {};
  const wholesalerIds = parseWholesalerIds(qs, multi);
  const invalid = invalidWholesalerIds(wholesalerIds);
  if (invalid.length) {
    return fail(400, "VALIDATION_ERROR", `Invalid wholesaler id(s): ${invalid.slice(0, 3).join(", ")}`);
  }

  const page = Math.max(1, Number(qs.page) || 1);
  const limit = Math.min(500, Math.max(1, Number(qs.limit) || 50));
  const offset = (page - 1) * limit;
  const search = clean(qs.search || qs.q);

  if (wholesalerIds.length) {
    const linkRes = await query(
      `
      SELECT wholesaler_account_id
      FROM wholesaler_retailer_links
      WHERE retailer_account_id = $1
        AND status = 'ACTIVE'
        AND wholesaler_account_id = ANY($2::uuid[])
      `,
      [ctx.accountId, wholesalerIds]
    );
    const linked = new Set((linkRes.rows || []).map((r) => String(r.wholesaler_account_id)));
    const missing = wholesalerIds.filter((id) => !linked.has(String(id)));
    if (missing.length) {
      return fail(
        403,
        "NOT_CONNECTED",
        "You must have an accepted connection with each selected wholesaler.",
        { missing_wholesaler_ids: missing }
      );
    }
  }

  const wh = ["p.deleted_at IS NULL", "l.status = 'ACTIVE'", "l.retailer_account_id = $1"];
  const ps = [ctx.accountId];

  if (wholesalerIds.length) {
    ps.push(wholesalerIds);
    wh.push(`p.account_id = ANY($${ps.length}::uuid[])`);
  }
  if (search) {
    ps.push(`%${search}%`);
    wh.push(
      `(p.name ILIKE $${ps.length} OR p.code ILIKE $${ps.length} OR COALESCE(p.drug_name, '') ILIKE $${ps.length})`
    );
  }
  const whereSql = wh.join(" AND ");

  const countRes = await query(
    `
    SELECT COUNT(*)::int AS c
    FROM products p
    JOIN wholesaler_retailer_links l
      ON l.wholesaler_account_id = p.account_id
     AND l.retailer_account_id = $1
     AND l.status = 'ACTIVE'
    WHERE ${whereSql}
    `,
    ps
  );
  const total = Number(countRes.rows?.[0]?.c || 0);

  const listParams = [...ps, limit, offset];
  const limitIdx = ps.length + 1;
  const offsetIdx = ps.length + 2;

  const rows = await query(
    `
    WITH stock AS (
      SELECT account_id, product_id, COALESCE(SUM(current_stock), 0)::numeric(14,3) AS current_stock
      FROM product_batches
      WHERE deleted_at IS NULL
      GROUP BY account_id, product_id
    ),
    rate AS (
      SELECT DISTINCT ON (account_id, product_id)
        account_id,
        product_id,
        sales_rate,
        mrp
      FROM product_batches
      WHERE deleted_at IS NULL
      ORDER BY account_id, product_id, expiry_date ASC NULLS LAST, created_at DESC
    )
    SELECT
      p.id AS product_id,
      p.id,
      p.account_id AS wholesaler_account_id,
      COALESCE(NULLIF(au.firm_name, ''), au.full_name, 'Wholesaler') AS wholesaler_name,
      au.full_name AS wholesaler_contact_name,
      au.email AS wholesaler_email,
      au.phone_country_code AS wholesaler_phone_country_code,
      au.phone_number AS wholesaler_phone_number,
      au.gst_number AS wholesaler_gst_number,
      au.city AS wholesaler_city,
      au.state AS wholesaler_state,
      COALESCE(l.discount_percent, 0) AS retailer_discount_percent,
      p.code AS product_code,
      p.code,
      p.name AS product_name,
      p.name,
      p.drug_name,
      p.packing,
      COALESCE(rate.sales_rate, rate.mrp, 0)::numeric(14,4) AS sales_rate,
      COALESCE(rate.sales_rate, rate.mrp, 0)::numeric(14,4) AS unit_price,
      rate.mrp,
      1 AS min_order_qty,
      NULL::numeric AS max_order_qty,
      p.sales_gst,
      COALESCE(stock.current_stock, 0) AS current_stock,
      COALESCE(stock.current_stock, 0) AS total_quantity
    FROM products p
    JOIN app_users au ON au.id = p.account_id
    JOIN wholesaler_retailer_links l
      ON l.wholesaler_account_id = p.account_id
     AND l.retailer_account_id = $1
     AND l.status = 'ACTIVE'
    LEFT JOIN stock
      ON stock.account_id = p.account_id
     AND stock.product_id = p.id
    LEFT JOIN rate
      ON rate.account_id = p.account_id
     AND rate.product_id = p.id
    WHERE ${whereSql}
    ORDER BY wholesaler_name ASC, p.name ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    listParams
  );

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return ok({
    items: rows.rows || [],
    filter: {
      source: "wholesaler_products",
      wholesaler_ids: wholesalerIds.length ? wholesalerIds : null,
      search: search || null
    },
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1
    }
  });
}

async function handler(event) {
  const qs = event?.queryStringParameters || {};
  const marketplaceMode = wantsWholesalerCatalog(qs);

  const auth = marketplaceMode
    ? await requireAnyPermission(event, [
        ["ORDERS", "VIEW"],
        ["WHOLESALER_LINKS", "VIEW"],
        ["PURCHASE_ORDERS", "VIEW"]
      ])
    : await requirePermission(event, "PRODUCT_BATCHES", "VIEW");
  if (!auth.ok) return auth.resp;

  const actorId = String(auth.claims?.sub || "");
  const ctx = await getPermissionsForUser(actorId);
  if (!ctx.accountId) return fail(400, "BAD_REQUEST", "account not found");

  try {
    if (marketplaceMode) {
      const actor = await getAccountContextForUser(actorId);
      if (String(actor?.role_code || "").toUpperCase() !== "RETAILER") {
        return fail(403, "FORBIDDEN", "Only retailers can list wholesaler products via /products.");
      }
      return await listWholesalerMarketplaceProducts(event, ctx);
    }
    return await listOwnProducts(event, ctx);
  } catch {
    return fail(500, "INTERNAL_ERROR", "Something went wrong.", { subMessage: "Please try again." });
  }
}

module.exports = { handler };
