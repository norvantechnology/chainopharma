const { created, fail } = require("../../shared/response");
const { parseJsonBody } = require("../../shared/request");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { withTransaction } = require("../../shared/db");
const { clean, n, nextDocNumber, round2 } = require("../../shared/purchase");
const { getPurchaseInvoiceItemReturnLimits, validateReturnLineQtys } = require("./_qtyLimits");

async function handler(event) {
  const auth = await requirePermission(event, "PURCHASE_RETURNS", "ADD");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const ctx = await getPermissionsForUser(actorId);
  if (!ctx.accountId) return fail(400, "BAD_REQUEST", "account not found");
  const body = parseJsonBody(event);

  const purchaseInvoiceId = clean(body.purchaseInvoiceId);
  const returnDate = clean(body.returnDate);
  const returnReason = clean(body.returnReason || "OTHER").toUpperCase();
  const creditNoteNumber = clean(body.creditNoteNumber) || null;
  const notes = clean(body.notes) || null;
  const items = Array.isArray(body.items) ? body.items : [];
  if (!purchaseInvoiceId) return fail(400, "VALIDATION_ERROR", "purchaseInvoiceId is required.");
  if (!returnDate) return fail(400, "VALIDATION_ERROR", "returnDate is required.");
  if (!items.length) return fail(400, "VALIDATION_ERROR", "At least one return item is required.");

  try {
    const data = await withTransaction(async (q) => {
      const inv = await q(
        `SELECT * FROM purchase_invoices WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [purchaseInvoiceId, ctx.accountId]
      );
      const invoice = inv.rows?.[0];
      if (!invoice) return { err: fail(404, "NOT_FOUND", "Original purchase invoice not found.") };

      const returnNumber = clean(body.returnNumber) || (await nextDocNumber(q, "purchase_returns", "PR", ctx.accountId));
      const rs = await q(
        `
        INSERT INTO purchase_returns (
          account_id, return_number, purchase_invoice_id, vendor_id, division_id, division_name,
          purchase_source,
          return_date, return_reason,
          status, credit_note_number, notes, created_by_user_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT',$10,$11,$12)
        RETURNING *
        `,
        [
          ctx.accountId,
          returnNumber,
          purchaseInvoiceId,
          invoice.division_id ? null : invoice.vendor_id || null,
          invoice.division_id || null,
          invoice.division_name || null,
          invoice.division_id ? "DIVISION" : "VENDOR",
          returnDate,
          returnReason,
          creditNoteNumber,
          notes,
          actorId
        ]
      );
      const ret = rs.rows?.[0];
      let total = 0;
      for (const it of items) {
        const purchaseInvoiceItemId = clean(it.purchaseInvoiceItemId);
        const returnQty = n(it.returnQty);
        const returnFreeQty = n(it.returnFreeQty);
        if (!purchaseInvoiceItemId || !(returnQty > 0) || returnFreeQty < 0) {
          return { err: fail(400, "VALIDATION_ERROR", "Each return item must have purchaseInvoiceItemId, returnQty > 0 and returnFreeQty >= 0.") };
        }

        const limits = await getPurchaseInvoiceItemReturnLimits(
          q,
          ctx.accountId,
          purchaseInvoiceItemId,
          purchaseInvoiceId,
          null
        );
        const qtyErr = validateReturnLineQtys({ returnQty, returnFreeQty, limits });
        if (qtyErr) return { err: fail(400, "VALIDATION_ERROR", qtyErr) };

        const srcR = await q(
          `
          SELECT purchase_rate
          FROM purchase_invoice_items
          WHERE id = $1 AND account_id = $2 AND purchase_invoice_id = $3
          LIMIT 1
          `,
          [purchaseInvoiceItemId, ctx.accountId, purchaseInvoiceId]
        );
        const src = srcR.rows?.[0];
        if (!src) return { err: fail(400, "VALIDATION_ERROR", "Invalid source purchase invoice item in return.") };
        if (!limits.batchId) {
          return { err: fail(400, "VALIDATION_ERROR", "Purchase invoice line has no batch; confirm the purchase invoice first.") };
        }
        const amount = round2(returnQty * n(src.purchase_rate));
        total += amount;
        await q(
          `
          INSERT INTO purchase_return_items (
            account_id, purchase_return_id, purchase_invoice_item_id, batch_id, return_qty, return_free_qty, return_amount, notes
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `,
          [ctx.accountId, ret.id, purchaseInvoiceItemId, limits.batchId, returnQty, returnFreeQty, amount, clean(it.notes) || null]
        );
      }
      await q(`UPDATE purchase_returns SET total_amount = $3 WHERE id = $1 AND account_id = $2`, [ret.id, ctx.accountId, round2(total)]);
      const out = await q(`SELECT * FROM purchase_returns WHERE id = $1 AND account_id = $2 LIMIT 1`, [ret.id, ctx.accountId]);
      return { item: out.rows?.[0] || null };
    });
    if (data?.err) return data.err;
    return created(data, { message: "Purchase return draft created." });
  } catch (e) {
    if (String(e.code || "") === "23505") return fail(409, "DUPLICATE", "Return number already exists.");
    return fail(500, "INTERNAL_ERROR", "Something went wrong.", { subMessage: "Please try again." });
  }
}

module.exports = { handler };
