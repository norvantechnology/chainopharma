const { clean } = require("../../shared/sales");

/**
 * Cancel one sales invoice inside an existing transaction (q).
 * Restores strip stock and reverses BREAK_PACK / LOOSE_SALE for tablet sales.
 * @returns {Promise<{ ok: true }|{ ok: false, code: string, message: string }>}
 */
async function cancelSalesInvoiceTx(q, { accountId, actorId, invoiceId, cancelReason }) {
  const reason = clean(cancelReason || "Cancelled from UI");
  const invRs = await q(`SELECT * FROM sales_invoices WHERE id = $1 AND account_id = $2 LIMIT 1`, [invoiceId, accountId]);
  const invoice = invRs.rows?.[0] || null;
  if (!invoice) return { ok: false, code: "NOT_FOUND", message: "Invoice not found" };
  if (String(invoice.status) === "CANCELLED") return { ok: true, alreadyCancelled: true, affectedBatchIds: [] };
  if (Number(invoice.amount_paid || 0) > 0) {
    return {
      ok: false,
      code: "BUSINESS_RULE",
      message: `Cannot cancel invoice with payments received (₹${invoice.amount_paid} paid).`
    };
  }
  const affectedBatchIds = [];
  if (String(invoice.status) === "CONFIRMED") {
    const items = await q(`SELECT * FROM sales_invoice_items WHERE sales_invoice_id = $1 AND account_id = $2`, [invoiceId, accountId]);
    for (const item of items.rows || []) {
      if (item.batch_id) affectedBatchIds.push(String(item.batch_id));

      const stripQty = Math.abs(Number(item.qty || 0));
      const freeQty = Math.abs(Number(item.free_qty || 0));
      if (stripQty > 0 || freeQty > 0) {
        await q(
          `INSERT INTO inventory_txns (account_id, batch_id, txn_type, qty, free_qty, ref_type, ref_id, note, created_by_user_id, created_at)
           VALUES ($1,$2,$3::inventory_txn_type,$4::numeric,$5::numeric,$6,$7,$8,$9,now())`,
          [
            accountId,
            item.batch_id,
            "SALE_CANCELLATION",
            stripQty,
            freeQty,
            "SALE_INVOICE_ITEM",
            item.id,
            `Cancellation of Invoice ${invoice.invoice_number}. Reason: ${reason}`,
            actorId
          ]
        );
      }

      // Reverse tablet sale + any packs broken for this line item
      const looseSold = Number(item.loose_qty || 0);
      const breakRs = await q(
        `SELECT COALESCE(SUM(ABS(qty)), 0)::numeric AS packs
         FROM inventory_txns
         WHERE account_id = $1
           AND batch_id = $2
           AND ref_type = 'SALE_INVOICE_ITEM'
           AND ref_id = $3
           AND txn_type = 'BREAK_PACK'::inventory_txn_type`,
        [accountId, item.batch_id, item.id]
      );
      const packsBroken = Number(breakRs.rows?.[0]?.packs || 0);

      if (looseSold > 0) {
        await q(
          `INSERT INTO inventory_txns (account_id, batch_id, txn_type, qty, free_qty, ref_type, ref_id, note, created_by_user_id, created_at)
           VALUES ($1,$2,$3::inventory_txn_type,0,0,$4,$5,$6,$7,now())`,
          [
            accountId,
            item.batch_id,
            "LOOSE_RETURN",
            "SALE_INVOICE_ITEM",
            item.id,
            `Cancel reverse loose sale: +${looseSold} tabs (Invoice ${invoice.invoice_number})`,
            actorId
          ]
        );
        await q(
          `UPDATE product_batches SET loose_stock = loose_stock + $3, updated_at = now() WHERE id = $1 AND account_id = $2`,
          [item.batch_id, accountId, looseSold]
        );
      }

      if (packsBroken > 0) {
        // Re-seal packs: remove loose tablets that came from break, restore strip stock
        const packFactorRs = await q(
          `SELECT COALESCE(packing_units, 10)::int AS packing_units FROM product_batches WHERE id = $1 AND account_id = $2 LIMIT 1`,
          [item.batch_id, accountId]
        );
        const packingUnits = Math.max(1, Number(packFactorRs.rows?.[0]?.packing_units || 10));
        const looseFromBreak = packsBroken * packingUnits;
        await q(
          `UPDATE product_batches
           SET loose_stock = GREATEST(0, loose_stock - $3), updated_at = now()
           WHERE id = $1 AND account_id = $2`,
          [item.batch_id, accountId, looseFromBreak]
        );
        await q(
          `INSERT INTO inventory_txns (account_id, batch_id, txn_type, qty, free_qty, ref_type, ref_id, note, created_by_user_id, created_at)
           VALUES ($1,$2,$3::inventory_txn_type,$4::numeric,0,$5,$6,$7,$8,now())`,
          [
            accountId,
            item.batch_id,
            "SALE_CANCELLATION",
            packsBroken,
            "SALE_INVOICE_ITEM",
            item.id,
            `Cancel reverse break-pack: restore ${packsBroken} strip(s) (−${looseFromBreak} loose) for Invoice ${invoice.invoice_number}`,
            actorId
          ]
        );
      }
    }
  }
  await q(
    `UPDATE sales_invoices
     SET status = 'CANCELLED'::sales_invoice_status, cancel_reason = $3, cancelled_at = now(), cancelled_by_user_id = $4, updated_at = now()
     WHERE id = $1 AND account_id = $2`,
    [invoiceId, accountId, reason, actorId]
  );
  return { ok: true, affectedBatchIds: [...new Set(affectedBatchIds)] };
}

module.exports = { cancelSalesInvoiceTx };
