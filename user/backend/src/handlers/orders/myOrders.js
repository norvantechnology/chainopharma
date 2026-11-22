const { ok, fail } = require("../../shared/response");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { query } = require("../../shared/db");
const { clean, getAccountContextForUser } = require("./_common");

const ORDER_STATUSES = new Set([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED"
]);

function parseStatuses(raw) {
  const parts = clean(raw)
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  if (!parts.length) return { ok: true, statuses: [] };
  const invalid = parts.filter((s) => !ORDER_STATUSES.has(s));
  if (invalid.length) {
    return {
      ok: false,
      message: `Invalid status: ${invalid.join(", ")}. Allowed: ${[...ORDER_STATUSES].join(", ")}`
    };
  }
  return { ok: true, statuses: [...new Set(parts)] };
}

function parseDateOnly(raw, fieldName) {
  const v = clean(raw);
  if (!v) return { ok: true, value: null };
  // Accept YYYY-MM-DD or full ISO datetime
  if (!/^\d{4}-\d{2}-\d{2}([T\s].*)?$/.test(v)) {
    return { ok: false, message: `${fieldName} must be YYYY-MM-DD (or ISO datetime).` };
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, message: `${fieldName} is not a valid date.` };
  }
  return { ok: true, value: v.length === 10 ? v : d.toISOString() };
}

/**
 * GET /orders/my-orders
 * Retailer: list own orders with filters.
 *
 * Query:
 * - status            single or comma-separated (PENDING,ACCEPTED,...)
 * - wholesaler_account_id / wholesalerAccountId / wholesaler_id
 * - search / q        order_number or wholesaler firm name
 * - date_from / from_date
 * - date_to / to_date
 * - page, limit
 */
async function handler(event) {
  const auth = await requirePermission(event, "ORDERS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "RETAILER") {
    return fail(403, "FORBIDDEN", "Only retailers can view my-orders.");
  }

  const qs = event?.queryStringParameters || {};
  const statusParse = parseStatuses(qs.status);
  if (!statusParse.ok) return fail(400, "VALIDATION_ERROR", statusParse.message);
  const statuses = statusParse.statuses;

  const wholesalerId = clean(
    qs.wholesaler_account_id || qs.wholesalerAccountId || qs.wholesaler_id || qs.wholesalerId
  );
  const search = clean(qs.search || qs.q);

  const fromParse = parseDateOnly(qs.date_from || qs.from_date || qs.dateFrom || qs.fromDate, "date_from");
  if (!fromParse.ok) return fail(400, "VALIDATION_ERROR", fromParse.message);
  const toParse = parseDateOnly(qs.date_to || qs.to_date || qs.dateTo || qs.toDate, "date_to");
  if (!toParse.ok) return fail(400, "VALIDATION_ERROR", toParse.message);
  const dateFrom = fromParse.value;
  const dateTo = toParse.value;

  const page = Math.max(1, Number(qs.page || 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(qs.limit || 20) || 20));
  const offset = (page - 1) * limit;

  const wh = ["o.retailer_account_id = $1"];
  const ps = [perms.accountId];

  if (statuses.length === 1) {
    ps.push(statuses[0]);
    wh.push(`o.status = $${ps.length}`);
  } else if (statuses.length > 1) {
    ps.push(statuses);
    wh.push(`o.status = ANY($${ps.length}::text[])`);
  }

  if (wholesalerId) {
    ps.push(wholesalerId);
    wh.push(`o.wholesaler_account_id = $${ps.length}`);
  }

  if (search) {
    ps.push(`%${search}%`);
    wh.push(`(o.order_number ILIKE $${ps.length} OR o.wholesaler_firm_name ILIKE $${ps.length})`);
  }

  if (dateFrom) {
    // Inclusive start of day when only a date is provided
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      ps.push(`${dateFrom}T00:00:00.000Z`);
    } else {
      ps.push(dateFrom);
    }
    wh.push(`o.placed_at >= $${ps.length}::timestamptz`);
  }

  if (dateTo) {
    // Inclusive end of day when only a date is provided
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      ps.push(`${dateTo}T23:59:59.999Z`);
    } else {
      ps.push(dateTo);
    }
    wh.push(`o.placed_at <= $${ps.length}::timestamptz`);
  }

  const whereSql = wh.join(" AND ");

  try {
    await query(
      `
      UPDATE orders o
      SET status = 'CANCELLED',
          cancellation_reason = 'Auto-cancelled: wholesaler unavailable > 7 days',
          cancelled_at = now(),
          updated_at = now()
      FROM app_users w
      WHERE o.wholesaler_account_id = w.id
        AND o.retailer_account_id = $1
        AND o.status = 'PENDING'
        AND o.placed_at <= now() - INTERVAL '7 days'
        AND (w.is_blocked = true OR UPPER(COALESCE(w.status, '')) IN ('PENDING', 'REJECTED'))
      `,
      [perms.accountId]
    );

    const totalR = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM orders o
      WHERE ${whereSql}
      `,
      ps
    );
    const rows = await query(
      `
      SELECT
        o.*,
        (w.is_blocked = true OR UPPER(COALESCE(w.status, '')) IN ('PENDING', 'REJECTED')) AS wholesaler_unavailable
      FROM orders o
      JOIN app_users w ON w.id = o.wholesaler_account_id
      WHERE ${whereSql}
      ORDER BY o.placed_at DESC
      LIMIT $${ps.length + 1} OFFSET $${ps.length + 2}
      `,
      [...ps, limit, offset]
    );
    const total = Number(totalR.rows?.[0]?.c || 0);
    return ok({
      items: rows.rows || [],
      filter: {
        status: statuses.length ? statuses : null,
        wholesaler_account_id: wholesalerId || null,
        search: search || null,
        date_from: dateFrom || null,
        date_to: dateTo || null
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
        has_next: page * limit < total,
        has_prev: page > 1
      }
    });
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to load orders.");
  }
}

module.exports = { handler };
