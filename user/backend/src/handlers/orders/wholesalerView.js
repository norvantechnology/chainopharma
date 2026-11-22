const { ok, fail } = require("../../shared/response");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { query } = require("../../shared/db");
const { clean, getAccountContextForUser } = require("./_common");

async function handler(event) {
  const auth = await requirePermission(event, "ORDERS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "WHOLESALER") {
    return fail(403, "FORBIDDEN", "Only wholesaler can use this endpoint.");
  }

  const id = clean(event?.pathParameters?.id);
  if (!id) return fail(400, "VALIDATION_ERROR", "order id is required.");
  try {
    const orderRs = await query(
      `SELECT * FROM orders WHERE id = $1 AND wholesaler_account_id = $2 LIMIT 1`,
      [id, perms.accountId]
    );
    const order = orderRs.rows?.[0];
    if (!order) return fail(404, "NOT_FOUND", "Order not found.");

    const itemsRs = await query(
      `
      SELECT
        oi.*,
        COALESCE(st.available_stock, 0) AS available_stock
      FROM order_items oi
      LEFT JOIN (
        SELECT account_id, product_id, COALESCE(SUM(current_stock), 0)::numeric(14,3) AS available_stock
        FROM product_batches
        WHERE deleted_at IS NULL
          AND is_hold = false
          AND stockable = true
          AND expiry_date > current_date
        GROUP BY account_id, product_id
      ) st ON st.account_id = oi.account_id AND st.product_id = oi.product_id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
      `,
      [id]
    );

    return ok({ order, items: itemsRs.rows || [] });
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to load wholesaler order view.");
  }
}

module.exports = { handler };

