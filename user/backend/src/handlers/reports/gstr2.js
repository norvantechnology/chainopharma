const { ok, fail } = require("../../shared/response");
const { query } = require("../../shared/db");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { resolveDateRange, todayYmdInTimeZone } = require("../../shared/dateFilters");

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round2(v) {
  return Math.round((n(v) + Number.EPSILON) * 100) / 100;
}

function monthStartYmd(ymd) {
  return `${String(ymd).slice(0, 7)}-01`;
}

async function vendorGstColumnExists() {
  try {
    const rs = await query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'gst_number'
       LIMIT 1`
    );
    return Boolean(rs.rows?.[0]);
  } catch {
    return false;
  }
}

async function handler(event) {
  const auth = await requirePermission(event, "PURCHASE_INVOICES", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const ctx = await getPermissionsForUser(actorId);
  if (!ctx.accountId) return fail(400, "BAD_REQUEST", "account not found");

  const qs = event?.queryStringParameters || {};
  let { from, to } = resolveDateRange(qs);
  if (!to) to = todayYmdInTimeZone();
  if (!from) from = monthStartYmd(to);

  try {
    const sellerRs = await query(
      `SELECT gst_number, firm_name, state, full_name
       FROM app_users WHERE id = $1 LIMIT 1`,
      [ctx.accountId]
    );
    const seller = sellerRs.rows?.[0] || {};
    const hasVendorGst = await vendorGstColumnExists();
    const vendorGstExpr = hasVendorGst
      ? `NULLIF(TRIM(v.gst_number), '')`
      : `NULL::text`;

    const invRs = await query(
      `SELECT
         pi.id,
         pi.invoice_number,
         pi.vendor_invoice_number,
         pi.invoice_date,
         COALESCE(NULLIF(TRIM(pi.division_name), ''), NULLIF(TRIM(v.name), ''), 'Supplier') AS supplier_name,
         ${vendorGstExpr} AS supplier_gstin,
         COALESCE(pi.total_amount, 0)::numeric(14,2) AS invoice_value,
         COALESCE(SUM(pii.taxable_amount), 0)::numeric(14,2) AS taxable,
         COALESCE(SUM(pii.gst_amount), 0)::numeric(14,2) AS gst,
         COALESCE(SUM(ROUND((COALESCE(pii.gst_amount, 0) / 2.0)::numeric, 2)), 0)::numeric(14,2) AS cgst,
         COALESCE(SUM(ROUND((COALESCE(pii.gst_amount, 0) / 2.0)::numeric, 2)), 0)::numeric(14,2) AS sgst
       FROM purchase_invoices pi
       LEFT JOIN purchase_invoice_items pii ON pii.purchase_invoice_id = pi.id
       LEFT JOIN vendors v ON v.id = pi.vendor_id
       WHERE pi.account_id = $1
         AND pi.deleted_at IS NULL
         AND pi.status = 'CONFIRMED'
         AND pi.invoice_date >= $2::date
         AND pi.invoice_date <= $3::date
       GROUP BY pi.id, v.name${hasVendorGst ? ", v.gst_number" : ""}
       ORDER BY pi.invoice_date ASC, pi.invoice_number ASC`,
      [ctx.accountId, from, to]
    );

    const b2b = (invRs.rows || []).map((r) => ({
      invoice_id: r.id,
      invoice_number: r.invoice_number,
      vendor_invoice_number: r.vendor_invoice_number || null,
      invoice_date: r.invoice_date,
      supplier_name: r.supplier_name || "",
      supplier_gstin: r.supplier_gstin || null,
      taxable: round2(r.taxable),
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      igst: 0,
      gst: round2(r.gst),
      invoice_value: round2(r.invoice_value)
    }));

    const cdnRs = await query(
      `SELECT
         pr.id,
         pr.return_number,
         pr.return_date,
         pr.credit_note_number,
         COALESCE(NULLIF(TRIM(pr.division_name), ''), NULLIF(TRIM(v.name), ''), 'Supplier') AS supplier_name,
         ${vendorGstExpr} AS supplier_gstin,
         pi.invoice_number AS original_invoice,
         pi.vendor_invoice_number AS original_vendor_invoice,
         COALESCE(SUM(
           CASE
             WHEN pii.id IS NOT NULL THEN
               ROUND((COALESCE(pri.return_qty, 0) * COALESCE(pii.taxable_amount, 0) / NULLIF(COALESCE(pii.qty, 0) + COALESCE(pii.free_qty, 0), 0))::numeric, 2)
             ELSE ROUND(COALESCE(pri.return_amount, 0)::numeric, 2)
           END
         ), 0)::numeric(14,2) AS taxable,
         COALESCE(SUM(
           CASE
             WHEN pii.id IS NOT NULL THEN
               ROUND((COALESCE(pri.return_qty, 0) * COALESCE(pii.gst_amount, 0) / NULLIF(COALESCE(pii.qty, 0) + COALESCE(pii.free_qty, 0), 0))::numeric, 2)
             ELSE 0
           END
         ), 0)::numeric(14,2) AS gst,
         COALESCE(pr.total_amount, 0)::numeric(14,2) AS note_value
       FROM purchase_returns pr
       LEFT JOIN purchase_invoices pi ON pi.id = pr.purchase_invoice_id
       LEFT JOIN vendors v ON v.id = pr.vendor_id
       LEFT JOIN purchase_return_items pri ON pri.purchase_return_id = pr.id
       LEFT JOIN purchase_invoice_items pii ON pii.id = pri.purchase_invoice_item_id
       WHERE pr.account_id = $1
         AND pr.status = 'CONFIRMED'
         AND pr.return_date >= $2::date
         AND pr.return_date <= $3::date
       GROUP BY pr.id, v.name${hasVendorGst ? ", v.gst_number" : ""}, pi.invoice_number, pi.vendor_invoice_number
       ORDER BY pr.return_date ASC, pr.return_number ASC`,
      [ctx.accountId, from, to]
    );

    const cdn = (cdnRs.rows || []).map((r) => {
      const gst = round2(r.gst);
      const half = round2(gst / 2);
      return {
        return_id: r.id,
        return_number: r.return_number,
        return_date: r.return_date,
        credit_note_number: r.credit_note_number || null,
        supplier_name: r.supplier_name || "",
        supplier_gstin: r.supplier_gstin || null,
        original_invoice: r.original_invoice || null,
        original_vendor_invoice: r.original_vendor_invoice || null,
        taxable: round2(r.taxable),
        cgst: half,
        sgst: half,
        igst: 0,
        gst,
        note_value: round2(r.note_value)
      };
    });

    const hsnRs = await query(
      `SELECT
         COALESCE(NULLIF(TRIM(pii.hsn_code), ''), NULLIF(TRIM(p.hsn_code), ''), 'UNKNOWN') AS hsn_code,
         COALESCE(pii.gst_percent, 0)::numeric(8,2) AS gst_percent,
         COALESCE(SUM(pii.qty), 0)::numeric(14,3) AS qty,
         COALESCE(SUM(pii.taxable_amount), 0)::numeric(14,2) AS taxable,
         COALESCE(SUM(pii.gst_amount), 0)::numeric(14,2) AS gst
       FROM purchase_invoice_items pii
       JOIN purchase_invoices pi ON pi.id = pii.purchase_invoice_id
       LEFT JOIN products p ON p.id = pii.product_id
       WHERE pi.account_id = $1
         AND pi.deleted_at IS NULL
         AND pi.status = 'CONFIRMED'
         AND pi.invoice_date >= $2::date
         AND pi.invoice_date <= $3::date
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      [ctx.accountId, from, to]
    );

    const hsn = (hsnRs.rows || []).map((r) => {
      const gst = round2(r.gst);
      const half = round2(gst / 2);
      return {
        hsn_code: r.hsn_code,
        gst_percent: n(r.gst_percent),
        qty: n(r.qty),
        taxable: round2(r.taxable),
        cgst: half,
        sgst: half,
        igst: 0,
        gst
      };
    });

    const sum = (rows, key) => round2(rows.reduce((s, r) => s + n(r[key]), 0));

    return ok({
      period: { from, to },
      seller: {
        gstin: seller.gst_number || null,
        firm_name: seller.firm_name || seller.full_name || null,
        state: seller.state || null
      },
      summary: {
        b2b_count: b2b.length,
        b2b_taxable: sum(b2b, "taxable"),
        b2b_gst: sum(b2b, "gst"),
        b2b_invoice_value: sum(b2b, "invoice_value"),
        cdn_count: cdn.length,
        cdn_taxable: sum(cdn, "taxable"),
        cdn_note_value: sum(cdn, "note_value"),
        hsn_count: hsn.length,
        supplier_gstin_available: hasVendorGst
      },
      b2b,
      cdn,
      hsn,
      limitations: [
        "Working paper from local purchase data (not GSTR-2A/2B portal match).",
        "CGST/SGST shown as 50/50 of line GST (purchase rows do not store split).",
        hasVendorGst
          ? "Supplier GSTIN comes from vendors.gst_number when filled."
          : "vendors.gst_number column not present yet — supplier GSTIN will be blank until migration 048 is applied."
      ]
    });
  } catch (e) {
    return fail(500, "INTERNAL_ERROR", "Something went wrong.", {
      subMessage: String(e.message || "Please try again.")
    });
  }
}

module.exports = { handler };
