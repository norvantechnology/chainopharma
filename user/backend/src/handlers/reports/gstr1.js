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

async function handler(event) {
  const auth = await requirePermission(event, "SALES_INVOICES", "VIEW");
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

    const invRs = await query(
      `SELECT
         si.id,
         si.invoice_number,
         si.invoice_date,
         si.bill_type,
         si.is_walk_in_sale,
         si.customer_name,
         NULLIF(TRIM(si.customer_gst), '') AS customer_gstin,
         COALESCE(si.total_amount, 0)::numeric(14,2) AS invoice_value,
         COALESCE(SUM(sii.taxable_amount), 0)::numeric(14,2) AS taxable,
         COALESCE(SUM(sii.cgst_amount), 0)::numeric(14,2) AS cgst,
         COALESCE(SUM(sii.sgst_amount), 0)::numeric(14,2) AS sgst,
         COALESCE(SUM(sii.igst_amount), 0)::numeric(14,2) AS igst,
         COALESCE(SUM(sii.gst_amount), 0)::numeric(14,2) AS gst
       FROM sales_invoices si
       LEFT JOIN sales_invoice_items sii ON sii.sales_invoice_id = si.id
       WHERE si.account_id = $1
         AND si.deleted_at IS NULL
         AND si.status = 'CONFIRMED'
         AND si.invoice_date >= $2::date
         AND si.invoice_date <= $3::date
       GROUP BY si.id
       ORDER BY si.invoice_date ASC, si.invoice_number ASC`,
      [ctx.accountId, from, to]
    );

    const b2b = [];
    const b2c = [];
    for (const row of invRs.rows || []) {
      const item = {
        invoice_id: row.id,
        invoice_number: row.invoice_number,
        invoice_date: row.invoice_date,
        bill_type: row.bill_type,
        customer_name: row.customer_name || "",
        customer_gstin: row.customer_gstin || null,
        taxable: round2(row.taxable),
        cgst: round2(row.cgst),
        sgst: round2(row.sgst),
        igst: round2(row.igst),
        gst: round2(row.gst),
        invoice_value: round2(row.invoice_value),
        place_of_supply: null
      };
      const isB2b =
        String(row.bill_type || "").toUpperCase() === "TAX_INVOICE" && Boolean(row.customer_gstin);
      if (isB2b) b2b.push(item);
      else b2c.push(item);
    }

    const cdnRs = await query(
      `SELECT
         sr.id,
         sr.return_number,
         sr.return_date,
         sr.customer_name,
         NULLIF(TRIM(COALESCE(si.customer_gst, c.gst_number, '')), '') AS customer_gstin,
         si.invoice_number AS original_invoice,
         si.invoice_date AS original_invoice_date,
         COALESCE(SUM(
           CASE
             WHEN sii.id IS NOT NULL THEN
               ROUND((
                 (COALESCE(sri.return_qty, 0) + COALESCE(sri.return_loose_qty, 0) / NULLIF(GREATEST(COALESCE(pb.packing_units, 10), 1), 0))
                 * COALESCE(sii.taxable_amount, 0)
                 / NULLIF(
                     COALESCE(sii.qty, 0) + COALESCE(sii.free_qty, 0) + COALESCE(sii.loose_qty, 0) / NULLIF(GREATEST(COALESCE(pb.packing_units, 10), 1), 0),
                     0
                   )
               )::numeric, 2)
             ELSE ROUND((COALESCE(sri.return_amount, 0) / 1.0)::numeric, 2)
           END
         ), 0)::numeric(14,2) AS taxable,
         COALESCE(SUM(
           CASE
             WHEN sii.id IS NOT NULL THEN
               ROUND((
                 (COALESCE(sri.return_qty, 0) + COALESCE(sri.return_loose_qty, 0) / NULLIF(GREATEST(COALESCE(pb.packing_units, 10), 1), 0))
                 * COALESCE(sii.cgst_amount, 0)
                 / NULLIF(
                     COALESCE(sii.qty, 0) + COALESCE(sii.free_qty, 0) + COALESCE(sii.loose_qty, 0) / NULLIF(GREATEST(COALESCE(pb.packing_units, 10), 1), 0),
                     0
                   )
               )::numeric, 2)
             ELSE 0
           END
         ), 0)::numeric(14,2) AS cgst,
         COALESCE(SUM(
           CASE
             WHEN sii.id IS NOT NULL THEN
               ROUND((
                 (COALESCE(sri.return_qty, 0) + COALESCE(sri.return_loose_qty, 0) / NULLIF(GREATEST(COALESCE(pb.packing_units, 10), 1), 0))
                 * COALESCE(sii.sgst_amount, 0)
                 / NULLIF(
                     COALESCE(sii.qty, 0) + COALESCE(sii.free_qty, 0) + COALESCE(sii.loose_qty, 0) / NULLIF(GREATEST(COALESCE(pb.packing_units, 10), 1), 0),
                     0
                   )
               )::numeric, 2)
             ELSE 0
           END
         ), 0)::numeric(14,2) AS sgst,
         COALESCE(SUM(
           CASE
             WHEN sii.id IS NOT NULL THEN
               ROUND((
                 (COALESCE(sri.return_qty, 0) + COALESCE(sri.return_loose_qty, 0) / NULLIF(GREATEST(COALESCE(pb.packing_units, 10), 1), 0))
                 * COALESCE(sii.igst_amount, 0)
                 / NULLIF(
                     COALESCE(sii.qty, 0) + COALESCE(sii.free_qty, 0) + COALESCE(sii.loose_qty, 0) / NULLIF(GREATEST(COALESCE(pb.packing_units, 10), 1), 0),
                     0
                   )
               )::numeric, 2)
             ELSE 0
           END
         ), 0)::numeric(14,2) AS igst,
         COALESCE(sr.total_return_amount, 0)::numeric(14,2) AS note_value
       FROM sales_returns sr
       LEFT JOIN sales_invoices si ON si.id = sr.sales_invoice_id
       LEFT JOIN customers c ON c.id = sr.customer_id
       LEFT JOIN sales_return_items sri ON sri.sales_return_id = sr.id
       LEFT JOIN sales_invoice_items sii ON sii.id = sri.sales_invoice_item_id
       LEFT JOIN product_batches pb ON pb.id = COALESCE(sri.batch_id, sii.batch_id) AND pb.account_id = sr.account_id
       WHERE sr.account_id = $1
         AND sr.status = 'CONFIRMED'
         AND sr.return_date >= $2::date
         AND sr.return_date <= $3::date
       GROUP BY sr.id, si.invoice_number, si.invoice_date, si.customer_gst, c.gst_number
       ORDER BY sr.return_date ASC, sr.return_number ASC`,
      [ctx.accountId, from, to]
    );

    const cdn = (cdnRs.rows || []).map((r) => ({
      return_id: r.id,
      return_number: r.return_number,
      return_date: r.return_date,
      customer_name: r.customer_name || "",
      customer_gstin: r.customer_gstin || null,
      original_invoice: r.original_invoice || null,
      original_invoice_date: r.original_invoice_date || null,
      taxable: round2(r.taxable),
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      igst: round2(r.igst),
      note_value: round2(r.note_value)
    }));

    const hsnRs = await query(
      `SELECT
         COALESCE(NULLIF(TRIM(p.hsn_code), ''), 'UNKNOWN') AS hsn_code,
         COALESCE(sii.gst_percent, 0)::numeric(8,2) AS gst_percent,
         COALESCE(SUM(sii.qty), 0)::numeric(14,3) AS qty,
         COALESCE(SUM(sii.taxable_amount), 0)::numeric(14,2) AS taxable,
         COALESCE(SUM(sii.cgst_amount), 0)::numeric(14,2) AS cgst,
         COALESCE(SUM(sii.sgst_amount), 0)::numeric(14,2) AS sgst,
         COALESCE(SUM(sii.igst_amount), 0)::numeric(14,2) AS igst,
         COALESCE(SUM(sii.gst_amount), 0)::numeric(14,2) AS gst
       FROM sales_invoice_items sii
       JOIN sales_invoices si ON si.id = sii.sales_invoice_id
       LEFT JOIN products p ON p.id = sii.product_id
       WHERE si.account_id = $1
         AND si.deleted_at IS NULL
         AND si.status = 'CONFIRMED'
         AND si.invoice_date >= $2::date
         AND si.invoice_date <= $3::date
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      [ctx.accountId, from, to]
    );

    const hsn = (hsnRs.rows || []).map((r) => ({
      hsn_code: r.hsn_code,
      gst_percent: n(r.gst_percent),
      qty: n(r.qty),
      taxable: round2(r.taxable),
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      igst: round2(r.igst),
      gst: round2(r.gst)
    }));

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
        b2c_count: b2c.length,
        b2c_taxable: sum(b2c, "taxable"),
        b2c_gst: sum(b2c, "gst"),
        b2c_invoice_value: sum(b2c, "invoice_value"),
        cdn_count: cdn.length,
        cdn_taxable: sum(cdn, "taxable"),
        cdn_note_value: sum(cdn, "note_value"),
        hsn_count: hsn.length
      },
      b2b,
      b2c,
      cdn,
      hsn,
      limitations: [
        "Working paper from local sales data (not GST portal JSON).",
        "IGST is typically 0 in this system (CGST/SGST 50-50 split).",
        "Place of supply is not stored.",
        "HSN taken from product master (may be UNKNOWN)."
      ]
    });
  } catch (e) {
    return fail(500, "INTERNAL_ERROR", "Something went wrong.", {
      subMessage: String(e.message || "Please try again.")
    });
  }
}

module.exports = { handler };
