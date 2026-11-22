const { created, fail } = require("../../shared/response");
const { parseJsonBody } = require("../../shared/request");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { withTransaction, query } = require("../../shared/db");
const { clean, n, round2, getAccountContextForUser, getAccountProfile, nextOrderNumber, createInAppNotification } = require("./_common");

async function handler(event) {
  const auth = await requirePermission(event, "ORDERS", "ADD");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const perms = await getPermissionsForUser(actorId);
  if (!perms.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const actor = await getAccountContextForUser(actorId);
  if (String(actor?.role_code || "").toUpperCase() !== "RETAILER") {
    return fail(403, "FORBIDDEN", "Only retailers can place orders.");
  }

  const body = parseJsonBody(event);
  const wholesalerAccountId = clean(body.wholesaler_account_id || body.wholesalerAccountId);
  const items = Array.isArray(body.items) ? body.items : [];
  const retailerNotes = clean(body.retailer_notes || body.retailerNotes) || null;

  if (!wholesalerAccountId) return fail(400, "VALIDATION_ERROR", "wholesaler_account_id is required.");
  if (String(wholesalerAccountId) === String(perms.accountId)) return fail(400, "VALIDATION_ERROR", "Wholesaler cannot be same as retailer.");
  if (!items.length) return fail(400, "VALIDATION_ERROR", "At least one item is required.");

  const wholesaler = await getAccountProfile(wholesalerAccountId);
  if (!wholesaler || String(wholesaler.role_code || "").toUpperCase() !== "WHOLESALER") {
    return fail(400, "VALIDATION_ERROR", "Invalid wholesaler account.");
  }

  const link = await query(
    `
    SELECT *
    FROM wholesaler_retailer_links
    WHERE wholesaler_account_id = $1
      AND retailer_account_id = $2
      AND status = 'ACTIVE'
    LIMIT 1
    `,
    [wholesalerAccountId, perms.accountId]
  );
  if (!link.rows?.[0]) {
    return fail(
      403,
      "NOT_CONNECTED",
      "You must have an accepted connection with this wholesaler before placing an order."
    );
  }
  const retailerDiscount = n(link.rows?.[0]?.discount_percent || 0);

  const productIds = [
    ...new Set(
      items
        .map((x) => clean(x.product_id || x.productId || x.catalog_id || x.catalogId))
        .filter(Boolean)
    )
  ];
  if (!productIds.length) return fail(400, "VALIDATION_ERROR", "product_id is required for each line.");

  const prod = await query(
    `
    WITH rate AS (
      SELECT DISTINCT ON (product_id)
        product_id,
        sales_rate,
        mrp
      FROM product_batches
      WHERE account_id = $1
        AND deleted_at IS NULL
        AND product_id = ANY($2::uuid[])
      ORDER BY product_id, expiry_date ASC NULLS LAST, created_at DESC
    )
    SELECT
      p.id AS product_id,
      p.code AS product_code,
      p.name AS product_name,
      p.drug_name,
      p.packing,
      p.sales_gst,
      COALESCE(rate.sales_rate, rate.mrp, 0)::numeric(14,4) AS unit_price,
      rate.mrp
    FROM products p
    LEFT JOIN rate ON rate.product_id = p.id
    WHERE p.account_id = $1
      AND p.deleted_at IS NULL
      AND p.id = ANY($2::uuid[])
    `,
    [wholesalerAccountId, productIds]
  );
  if ((prod.rows || []).length !== productIds.length) {
    return fail(400, "VALIDATION_ERROR", "One or more products are unavailable from this wholesaler.");
  }

  const lineByProduct = new Map((prod.rows || []).map((x) => [String(x.product_id), x]));
  const out = [];
  for (const raw of items) {
    const productId = clean(raw.product_id || raw.productId || raw.catalog_id || raw.catalogId);
    const qty = Math.max(0, Number(raw.qty || raw.quantity || 0) || 0);
    const p = lineByProduct.get(productId);
    if (!p) return fail(400, "VALIDATION_ERROR", "Invalid product.");
    if (!(qty > 0)) return fail(400, "VALIDATION_ERROR", `Quantity must be > 0 for ${p.product_name}.`);
    const unitPrice = n(p.unit_price);
    if (!(unitPrice > 0)) {
      return fail(400, "VALIDATION_ERROR", `No sellable rate configured for ${p.product_name}. Add a batch with sales rate.`);
    }

    const gross = unitPrice * qty;
    const discountAmount = round2(gross * (retailerDiscount / 100));
    const taxableAmount = round2(gross - discountAmount);
    const gstPercent = n(p.sales_gst);
    const gstAmount = round2(taxableAmount * (gstPercent / 100));
    const lineTotal = round2(taxableAmount + gstAmount);
    out.push({
      product_id: p.product_id,
      product_code: p.product_code,
      product_name: p.product_name,
      drug_name: p.drug_name || null,
      packing: p.packing || null,
      ordered_qty: qty,
      unit_price: round2(unitPrice),
      mrp: p.mrp != null ? round2(p.mrp) : null,
      discount_percent: retailerDiscount,
      discount_amount: discountAmount,
      taxable_amount: taxableAmount,
      gst_percent: gstPercent,
      gst_amount: gstAmount,
      line_total: lineTotal
    });
  }

  const subtotal = round2(out.reduce((s, x) => s + n(x.unit_price) * n(x.ordered_qty), 0));
  const totalDiscount = round2(out.reduce((s, x) => s + n(x.discount_amount), 0));
  const totalGst = round2(out.reduce((s, x) => s + n(x.gst_amount), 0));
  const totalAmount = round2(out.reduce((s, x) => s + n(x.line_total), 0));

  try {
    const data = await withTransaction(async (q) => {
      const orderNumber = await nextOrderNumber(q, wholesalerAccountId);
      const orderIns = await q(
        `
        INSERT INTO orders (
          order_number, retailer_account_id, retailer_firm_name,
          wholesaler_account_id, wholesaler_firm_name, status,
          subtotal, total_discount, total_gst, total_amount, retailer_notes
        )
        VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8,$9,$10)
        RETURNING *
        `,
        [
          orderNumber,
          perms.accountId,
          clean(actor?.firm_name) || clean(actor?.full_name) || "Retailer",
          wholesalerAccountId,
          clean(wholesaler?.firm_name) || clean(wholesaler?.full_name) || "Wholesaler",
          subtotal,
          totalDiscount,
          totalGst,
          totalAmount,
          retailerNotes
        ]
      );
      const order = orderIns.rows?.[0];

      for (const it of out) {
        await q(
          `
          INSERT INTO order_items (
            order_id, account_id, product_id, product_code, product_name, drug_name, packing,
            ordered_qty, unit_price, mrp, discount_percent, discount_amount, gst_percent, gst_amount, taxable_amount, line_total
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          `,
          [
            order.id,
            wholesalerAccountId,
            it.product_id,
            it.product_code,
            it.product_name,
            it.drug_name,
            it.packing,
            it.ordered_qty,
            it.unit_price,
            it.mrp,
            it.discount_percent,
            it.discount_amount,
            it.gst_percent,
            it.gst_amount,
            it.taxable_amount,
            it.line_total
          ]
        );
      }

      await createInAppNotification(
        q,
        wholesalerAccountId,
        wholesalerAccountId,
        "NEW_ORDER",
        `New order ${order.order_number}`,
        `${clean(actor?.firm_name) || clean(actor?.full_name) || "Retailer"} placed an order of ₹${totalAmount.toFixed(2)}.`,
        { order_id: order.id }
      );
      return { order };
    });
    if (data?.err) return data.err;
    return created(data, { message: "Order placed." });
  } catch {
    return fail(500, "INTERNAL_ERROR", "Failed to place order.");
  }
}

module.exports = { handler };
