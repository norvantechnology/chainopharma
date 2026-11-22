"use strict";

/**
 * Shared print document utilities for Chaino Pharma.
 * Used by both frontend (Vite/ESM via CJS interop) and backend (Node.js/CJS).
 *
 * Exports:
 *   esc(v)                                          – HTML-escape a value
 *   getMedicoPrintDocumentCss()                     – shared print CSS
 *   buildSalesInvoiceBodyHtml(data)                 – body HTML for sales invoice
 *   buildSalesInvoiceCompleteHtmlDocument(doc, opts) – full HTML document for PDF
 */

/** HTML-escape a value for safe insertion into HTML. */
function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a number as money (2 decimal places). */
function money(v) {
  return Number(v || 0).toFixed(2);
}

/** Format a date string as YYYY-MM-DD (first 10 chars). */
function ymd(v) {
  return String(v || "").slice(0, 10) || "-";
}

/** Format expiry date (YYYY-MM-DD or YYYY-MM) as MM/YYYY. */
function expiry(v) {
  const s = String(v || "").slice(0, 7);
  if (!s || s === "-") return "-";
  const parts = s.split("-");
  const y = parts[0];
  const m = parts[1];
  return m && y ? `${m}/${y}` : s;
}

/**
 * Returns the shared CSS for all Chaino Pharma print documents.
 * @returns {string}
 */
function getMedicoPrintDocumentCss() {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; }

    .prDoc { max-width: 210mm; margin: 0 auto; padding: 12mm 14mm; }

    /* ── Header ── */
    .prHead { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 8px; }
    .prHeadLeft { flex: 1; }
    .prHeadRight { text-align: right; flex-shrink: 0; margin-left: 16px; }
    .prTitle { font-size: 18px; font-weight: bold; color: #111; margin-bottom: 2px; }
    .prSub { font-size: 11px; color: #444; margin-top: 2px; }
    .prMeta { font-size: 10px; color: #666; margin-top: 2px; }
    .prInvNo { font-size: 14px; font-weight: bold; color: #111; }
    .prInvDate { font-size: 10px; color: #555; margin-top: 2px; }

    /* ── Two-column info grid ── */
    .prInfoGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
    .prInfoBox { border: 1px solid #ddd; border-radius: 3px; padding: 7px 10px; }
    .prInfoBox h4 { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
    .prInfoBox p { font-size: 10px; color: #333; margin-top: 2px; line-height: 1.4; }
    .prInfoBox strong { color: #111; }

    /* ── Section ── */
    .prSection { margin: 10px 0; }
    .prSectionTitle { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 4px; }

    /* ── Items table ── */
    .prTable { width: 100%; border-collapse: collapse; font-size: 10px; }
    .prTable th { background: #f0f0f0; border: 1px solid #ccc; padding: 5px 6px; text-align: left; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; color: #444; }
    .prTable td { border: 1px solid #ddd; padding: 4px 6px; vertical-align: top; color: #222; }
    .prTable tbody tr:nth-child(even) td { background: #fafafa; }
    .prNum { text-align: right !important; }
    .prCenter { text-align: center !important; }
    .prEmpty { text-align: center; color: #999; font-style: italic; padding: 12px !important; }

    /* ── Totals ── */
    .prTotalsWrap { display: flex; justify-content: flex-end; margin-top: 8px; }
    .prTotalsBox { min-width: 220px; border: 1px solid #ddd; border-radius: 3px; overflow: hidden; }
    .prTotalsRow { display: flex; justify-content: space-between; padding: 4px 10px; font-size: 10px; border-bottom: 1px solid #eee; }
    .prTotalsRow:last-child { border-bottom: none; }
    .prTotalsRow.prGrandTotal { background: #f0f0f0; font-weight: bold; font-size: 11px; }
    .prTotalsRow.prPaid { color: #2a7a2a; }
    .prTotalsRow.prBalance { color: #c00; font-weight: bold; }
    .prTotalsLabel { color: #555; }
    .prTotalsValue { font-weight: 600; color: #111; }

    /* ── Tax / payment grid ── */
    .prTaxGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
    .prPayTable { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
    .prPayTable th { background: #f5f5f5; border: 1px solid #ddd; padding: 4px 6px; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #555; }
    .prPayTable td { border: 1px solid #eee; padding: 4px 6px; color: #333; }

    /* ── Status badge ── */
    .prBadge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
    .prBadgePaid    { background: #d4edda; color: #155724; }
    .prBadgePartial { background: #fff3cd; color: #856404; }
    .prBadgeUnpaid  { background: #f8d7da; color: #721c24; }

    /* ── Ledger / generic ── */
    .prGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .prCard { border: 1px solid #ddd; border-radius: 3px; padding: 8px 10px; }
    .prCard h3 { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 6px; }
    .prRow { display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0; border-bottom: 1px solid #f0f0f0; }
    .prRow:last-child { border-bottom: none; }
    .prTotals { border: 1px solid #ddd; border-radius: 3px; padding: 8px 10px; }

    /* ── Footer ── */
    .prFooter { margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 9px; color: #888; }

    /* ── Print / no-print ── */
    .prNoPrint { }
    @media print {
      .prNoPrint { display: none !important; }
      body { font-size: 10px; }
      .prDoc { padding: 0; max-width: 100%; }
      @page { size: A4; margin: 10mm 12mm; }
    }
  `;
}

/**
 * Build the body HTML for a sales invoice.
 * @param {object} data – shape from getSalesInvoicePrintDoc
 * @returns {string} HTML string (body content only, no <html>/<head>)
 */
function buildSalesInvoiceBodyHtml(data) {
  const inv      = data?.invoice    || {};
  const seller   = data?.seller     || {};
  const items    = Array.isArray(data?.items)       ? data.items       : [];
  const payments = Array.isArray(data?.payments)    ? data.payments    : [];
  const taxSum   = Array.isArray(data?.tax_summary) ? data.tax_summary : [];

  /* ── Seller ── */
  const sellerName  = esc(seller.firm_name || seller.full_name || "");
  const sellerGst   = esc(seller.gst_number   || "");
  const sellerAddr  = esc(seller.address       || "");
  const sellerPhone = esc(seller.phone_number  || "");
  const sellerEmail = esc(seller.email         || "");

  /* ── Invoice header ── */
  const invNo    = esc(inv.invoice_number || "");
  const invDate  = ymd(inv.invoice_date);
  const dueDate  = ymd(inv.due_date);
  const billType = esc(inv.bill_type || "");

  /* ── Customer ── */
  const custName  = esc(inv.customer_name || "");
  const custCode  = esc(inv.customer_code || "");
  const custPhone = esc(inv.customer_phone || "");
  const custEmail = esc(inv.customer_email || "");
  const custGst   = esc(inv.customer_gst_number || inv.customer_gst || "");
  const custDl    = esc(inv.customer_drug_license || "");
  const custAddr  = [inv.customer_address, inv.customer_city, inv.customer_state, inv.customer_pincode]
    .filter(Boolean).map(esc).join(", ");

  /* ── Totals ── */
  const subtotal      = money(inv.subtotal);
  const totalDiscount = money(inv.total_discount);
  const totalGst      = money(inv.total_gst);
  const totalAmount   = money(inv.total_amount);
  const amountPaid    = money(inv.amount_paid_resolved  != null ? inv.amount_paid_resolved  : inv.amount_paid);
  const balanceDue    = money(inv.balance_due_resolved  != null ? inv.balance_due_resolved  : inv.balance_due);
  const payStatus     = String(inv.payment_status_resolved || inv.payment_status || "UNPAID").toUpperCase();
  const badgeClass    = payStatus === "PAID" ? "prBadgePaid" : payStatus === "PARTIAL" ? "prBadgePartial" : "prBadgeUnpaid";

  /* ── Item rows ── */
  const itemRows = items.length
    ? items.map((it, i) => {
        const freeQty = Number(it.free_qty || 0);
        const qtyStr  = freeQty > 0 ? `${esc(it.qty)}+${freeQty}F` : esc(it.qty);
        return `<tr>
          <td class="prCenter">${i + 1}</td>
          <td>${esc(it.product_name || it.drug_name || "")}${it.product_code ? `<br><span style="color:#888;font-size:9px">${esc(it.product_code)}</span>` : ""}</td>
          <td>${esc(it.batch_no || "-")}</td>
          <td class="prCenter">${expiry(it.expiry_date)}</td>
          <td class="prNum">${money(it.mrp)}</td>
          <td class="prCenter">${qtyStr}</td>
          <td class="prNum">${money(it.sales_rate)}</td>
          <td class="prNum">${money(it.discount_amount)}</td>
          <td class="prCenter">${esc(it.gst_percent != null ? it.gst_percent : 0)}%</td>
          <td class="prNum">${money(it.gst_amount)}</td>
          <td class="prNum"><strong>${money(it.line_total)}</strong></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="11" class="prEmpty">No items</td></tr>`;

  /* ── Tax summary rows ── */
  const taxRows = taxSum.length
    ? taxSum.map(t => `<tr>
        <td>${esc(t.gst_percent)}%</td>
        <td class="prNum">${money(t.taxable_amount)}</td>
        <td class="prNum">${money(t.gst_amount)}</td>
      </tr>`).join("")
    : `<tr><td colspan="3" class="prEmpty">-</td></tr>`;

  /* ── Payment rows ── */
  const payRows = payments.length
    ? payments.map(p => `<tr>
        <td>${ymd(p.payment_date)}</td>
        <td>${esc(p.payment_mode || "-")}</td>
        <td class="prNum">${money(p.amount)}</td>
        <td>${esc(p.reference_number || "-")}</td>
        <td>${esc(p.notes || "-")}</td>
      </tr>`).join("")
    : "";

  const notesHtml = inv.notes
    ? `<div class="prSection"><p class="prSectionTitle">Notes</p><p style="font-size:10px;color:#444;margin-top:4px">${esc(inv.notes)}</p></div>`
    : "";

  const discountRow = Number(inv.total_discount || 0) > 0
    ? `<div class="prTotalsRow"><span class="prTotalsLabel">Discount</span><span class="prTotalsValue">-&#8377;${totalDiscount}</span></div>`
    : "";

  const paidRow = Number(inv.amount_paid_resolved != null ? inv.amount_paid_resolved : inv.amount_paid || 0) > 0
    ? `<div class="prTotalsRow prPaid"><span class="prTotalsLabel">Paid</span><span class="prTotalsValue">&#8377;${amountPaid}</span></div>`
    : "";

  return `
    <div class="prDoc">

      <!-- ── Header ── -->
      <div class="prHead">
        <div class="prHeadLeft">
          <div class="prTitle">${sellerName || "Sales Invoice"}</div>
          ${sellerGst   ? `<div class="prSub">GST: ${sellerGst}</div>` : ""}
          ${sellerAddr  ? `<div class="prMeta">${sellerAddr}</div>` : ""}
          ${sellerPhone ? `<div class="prMeta">Ph: ${sellerPhone}${sellerEmail ? ` | ${sellerEmail}` : ""}</div>` : ""}
        </div>
        <div class="prHeadRight">
          <div class="prInvNo">Invoice #${invNo}</div>
          <div class="prInvDate">Date: ${invDate}</div>
          ${dueDate !== "-" ? `<div class="prInvDate">Due: ${dueDate}</div>` : ""}
          ${billType ? `<div class="prInvDate">Type: ${billType}</div>` : ""}
          <div style="margin-top:4px"><span class="prBadge ${badgeClass}">${payStatus}</span></div>
          <div class="prNoPrint" style="margin-top:6px">
            <button onclick="window.print()" style="font-size:10px;padding:3px 10px;cursor:pointer">Print</button>
          </div>
        </div>
      </div>

      <!-- ── Bill-to / Invoice details ── -->
      <div class="prInfoGrid">
        <div class="prInfoBox">
          <h4>Bill To</h4>
          <p><strong>${custName}</strong>${custCode ? ` (${custCode})` : ""}</p>
          ${custAddr  ? `<p>${custAddr}</p>`        : ""}
          ${custPhone ? `<p>Ph: ${custPhone}</p>`   : ""}
          ${custEmail ? `<p>${custEmail}</p>`        : ""}
          ${custGst   ? `<p>GST: ${custGst}</p>`    : ""}
          ${custDl    ? `<p>DL: ${custDl}</p>`      : ""}
        </div>
        <div class="prInfoBox">
          <h4>Invoice Details</h4>
          <p><strong>Invoice No:</strong> ${invNo}</p>
          <p><strong>Date:</strong> ${invDate}</p>
          ${dueDate !== "-" ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ""}
          <p><strong>Status:</strong> <span class="prBadge ${badgeClass}">${payStatus}</span></p>
        </div>
      </div>

      <!-- ── Line items ── -->
      <div class="prSection">
        <p class="prSectionTitle">Items</p>
        <table class="prTable">
          <thead>
            <tr>
              <th class="prCenter">#</th>
              <th>Product</th>
              <th>Batch</th>
              <th class="prCenter">Expiry</th>
              <th class="prNum">MRP</th>
              <th class="prCenter">Qty</th>
              <th class="prNum">Rate</th>
              <th class="prNum">Disc</th>
              <th class="prCenter">GST%</th>
              <th class="prNum">GST</th>
              <th class="prNum">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>

      <!-- ── Tax summary + Payments + Totals ── -->
      <div class="prTaxGrid">
        <div>
          ${taxSum.length ? `
          <p class="prSectionTitle">Tax Summary</p>
          <table class="prTable" style="margin-top:4px">
            <thead>
              <tr>
                <th>GST %</th>
                <th class="prNum">Taxable</th>
                <th class="prNum">GST Amt</th>
              </tr>
            </thead>
            <tbody>${taxRows}</tbody>
          </table>` : ""}

          ${payments.length ? `
          <p class="prSectionTitle" style="margin-top:8px">Payments Received</p>
          <table class="prPayTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th class="prNum">Amount</th>
                <th>Ref</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${payRows}</tbody>
          </table>` : ""}
        </div>

        <div>
          <div class="prTotalsWrap">
            <div class="prTotalsBox">
              <div class="prTotalsRow">
                <span class="prTotalsLabel">Subtotal</span>
                <span class="prTotalsValue">&#8377;${subtotal}</span>
              </div>
              ${discountRow}
              <div class="prTotalsRow">
                <span class="prTotalsLabel">GST</span>
                <span class="prTotalsValue">&#8377;${totalGst}</span>
              </div>
              <div class="prTotalsRow prGrandTotal">
                <span class="prTotalsLabel">Total</span>
                <span class="prTotalsValue">&#8377;${totalAmount}</span>
              </div>
              ${paidRow}
              <div class="prTotalsRow prBalance">
                <span class="prTotalsLabel">Balance Due</span>
                <span class="prTotalsValue">&#8377;${balanceDue}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${notesHtml}

      <!-- ── Footer ── -->
      <div class="prFooter">
        <span>Generated: ${new Date().toLocaleString()}</span>
        <span>Invoice: ${invNo} | ${custName}</span>
        <span>Computer-generated document.</span>
      </div>

    </div>
  `;
}

/**
 * Build a complete HTML document (for PDF generation via Puppeteer).
 * @param {object} doc      – shape from getSalesInvoicePrintDoc
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @returns {string} Complete <!doctype html> … </html> string
 */
function buildSalesInvoiceCompleteHtmlDocument(doc, opts) {
  const inv   = doc?.invoice || {};
  const title = (opts && opts.title) || ("Invoice " + (inv.invoice_number || "")).trim() || "Sales Invoice";
  const css   = getMedicoPrintDocumentCss();
  const body  = buildSalesInvoiceBodyHtml(doc);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${esc(title)}</title>
    <style>${css}</style>
  </head>
  <body>${body}</body>
</html>`;
}

module.exports = {
  esc,
  getMedicoPrintDocumentCss,
  buildSalesInvoiceBodyHtml,
  buildSalesInvoiceCompleteHtmlDocument
};

// ESM interop: allows `import medico from "..."` in Vite / bundlers
module.exports.default = module.exports;