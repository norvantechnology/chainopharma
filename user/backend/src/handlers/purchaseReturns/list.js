const { ok, fail } = require("../../shared/response");
const { query } = require("../../shared/db");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { clean } = require("../../shared/purchase");
const { resolveDateRange, applyDateRangeDate } = require("../../shared/dateFilters");

async function handler(event) {
  const auth = await requirePermission(event, "PURCHASE_RETURNS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const ctx = await getPermissionsForUser(actorId);
  if (!ctx.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const qs = event?.queryStringParameters || {};
  const page = Math.max(1, Number(qs.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(qs.limit) || 50));
  const offset = (page - 1) * limit;
  const qText = clean(qs.q || qs.search);
  const status = clean(qs.status).toUpperCase();
  const vendorId = clean(qs.vendorId || qs.vendor_id);
  const purchaseInvoiceId = clean(qs.purchaseInvoiceId || qs.purchase_invoice_id);
  const dateRange = resolveDateRange(qs);
  const wh = ["pr.account_id = $1"];
  const ps = [ctx.accountId];
  if (qText) {
    ps.push(`%${qText}%`);
    wh.push(
      `(pr.return_number ILIKE $${ps.length} OR pi.invoice_number ILIKE $${ps.length} OR COALESCE(NULLIF(pr.division_name,''), v.name, '') ILIKE $${ps.length})`
    );
  }
  if (status) {
    ps.push(status);
    wh.push(`pr.status = $${ps.length}::purchase_return_status`);
  }
  if (vendorId) {
    ps.push(vendorId);
    wh.push(`pr.vendor_id = $${ps.length}`);
  }
  if (purchaseInvoiceId) {
    ps.push(purchaseInvoiceId);
    wh.push(`pr.purchase_invoice_id = $${ps.length}`);
  }
  applyDateRangeDate(wh, ps, "pr.return_date", dateRange);
  const whereSql = `WHERE ${wh.join(" AND ")}`;
  try {
    const tc = await query(
      `SELECT COUNT(*)::int AS c
         FROM purchase_returns pr
         LEFT JOIN purchase_invoices pi ON pi.id = pr.purchase_invoice_id AND pi.account_id = pr.account_id
         LEFT JOIN vendors v ON v.id = pr.vendor_id AND v.account_id = pr.account_id
         ${whereSql}`,
      ps
    );
    const total = Number(tc.rows?.[0]?.c || 0);
    const rs = await query(
      `SELECT pr.*,
              pi.invoice_number,
              COALESCE(NULLIF(pr.division_name,''), v.name, '') AS party_name
         FROM purchase_returns pr
         LEFT JOIN purchase_invoices pi ON pi.id = pr.purchase_invoice_id AND pi.account_id = pr.account_id
         LEFT JOIN vendors v ON v.id = pr.vendor_id AND v.account_id = pr.account_id
         ${whereSql}
         ORDER BY pr.created_at DESC
         LIMIT $${ps.length + 1} OFFSET $${ps.length + 2}`,
      [...ps, limit, offset]
    );
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return ok({
      items: rs.rows || [],
      pagination: { page, limit, total, total_pages: totalPages, has_next: page < totalPages, has_prev: page > 1 }
    });
  } catch {
    return fail(500, "INTERNAL_ERROR", "Something went wrong.");
  }
}

module.exports = { handler };
