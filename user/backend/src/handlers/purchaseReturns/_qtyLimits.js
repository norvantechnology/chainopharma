const { n } = require("../../shared/purchase");

const RETURN_STATUSES = ["DRAFT", "CONFIRMED"];

async function sumReturnedForInvoiceItem(q, accountId, purchaseInvoiceItemId, excludeReturnId = null) {
  const rs = await q(
    `
    SELECT
      COALESCE(SUM(pri.return_qty), 0) AS qty_sum,
      COALESCE(SUM(pri.return_free_qty), 0) AS free_qty_sum
    FROM purchase_return_items pri
    JOIN purchase_returns pr ON pr.id = pri.purchase_return_id
    WHERE pri.account_id = $1
      AND pri.purchase_invoice_item_id = $2
      AND pr.status::text = ANY($4::text[])
      AND ($3::uuid IS NULL OR pr.id <> $3)
    `,
    [accountId, purchaseInvoiceItemId, excludeReturnId, RETURN_STATUSES]
  );
  return {
    qty: n(rs.rows?.[0]?.qty_sum),
    freeQty: n(rs.rows?.[0]?.free_qty_sum)
  };
}

async function getPurchaseInvoiceItemReturnLimits(q, accountId, purchaseInvoiceItemId, purchaseInvoiceId, excludeReturnId = null) {
  const srcR = await q(
    `
    SELECT qty, free_qty, batch_id, confirmed_batch_id, mfg_company_id
    FROM purchase_invoice_items
    WHERE id = $1
      AND account_id = $2
      AND ($3::uuid IS NULL OR purchase_invoice_id = $3)
    LIMIT 1
    `,
    [purchaseInvoiceItemId, accountId, purchaseInvoiceId || null]
  );
  const src = srcR.rows?.[0];
  if (!src) return null;

  const purchasedQty = n(src.qty);
  const purchasedFreeQty = n(src.free_qty);
  const used = await sumReturnedForInvoiceItem(q, accountId, purchaseInvoiceItemId, excludeReturnId);

  return {
    purchasedQty,
    purchasedFreeQty,
    batchId: src.confirmed_batch_id || src.batch_id || null,
    mfgCompanyId: src.mfg_company_id || null,
    usedQty: used.qty,
    usedFreeQty: used.freeQty,
    maxReturnableQty: Math.max(0, purchasedQty - used.qty),
    maxReturnableFreeQty: Math.max(0, purchasedFreeQty - used.freeQty)
  };
}

function validateReturnLineQtys({ returnQty, returnFreeQty, limits }) {
  if (!limits) {
    return "Invalid source purchase invoice item in return.";
  }
  if (!(returnQty > 0)) {
    return "Each return item must have returnQty > 0.";
  }
  if (returnFreeQty < 0) {
    return "returnFreeQty cannot be negative.";
  }
  if (returnQty > limits.maxReturnableQty + 1e-9) {
    return `Return qty (${returnQty}) exceeds available (${limits.maxReturnableQty}) from purchased qty (${limits.purchasedQty}), already returned (${limits.usedQty}).`;
  }
  if (returnFreeQty > limits.maxReturnableFreeQty + 1e-9) {
    return `Return free qty (${returnFreeQty}) exceeds available (${limits.maxReturnableFreeQty}) from purchased free qty (${limits.purchasedFreeQty}), already returned (${limits.usedFreeQty}).`;
  }
  return null;
}

module.exports = {
  getPurchaseInvoiceItemReturnLimits,
  validateReturnLineQtys
};
