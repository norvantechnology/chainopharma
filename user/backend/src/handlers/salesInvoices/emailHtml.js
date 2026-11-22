function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function buildSalesInvoiceEmailHtml(doc) {
  const inv = doc.invoice || {};
  const seller = doc.seller || {};
  const invNo = escapeHtml(inv.invoice_number || "");
  const cust = escapeHtml(inv.customer_name || "");
  const d = String(inv.invoice_date || "").slice(0, 10);
  const bodyRows = (doc.items || [])
    .map(
      (l) =>
        `<tr><td style="padding:6px;border:1px solid #ddd;">${escapeHtml(
          l.product_name || l.product_code || ""
        )}</td><td style="padding:6px;border:1px solid #ddd;text-align:right;">${n(l.qty)}</td><td style="padding:6px;border:1px solid #ddd;text-align:right;">₹${n(
          l.line_total
        ).toFixed(2)}</td></tr>`
    )
    .join("");

  const sub = n(inv.total_amount);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#1a1a1a">
  <p><strong>${escapeHtml(seller.firm_name || seller.full_name || "Your pharmacy")}</strong></p>
  <h2 style="margin:0 0 8px 0">Sales invoice ${invNo}</h2>
  <p style="margin:4px 0">Customer: <strong>${cust}</strong><br/>Date: ${escapeHtml(d)}<br/>Status: ${escapeHtml(
    String(inv.status || "")
  )}</p>
  <table style="border-collapse:collapse;width:100%;max-width:640px">
    <thead>
      <tr>
        <th style="text-align:left;padding:6px;border:1px solid #ddd;">Product</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Qty</th>
        <th style="text-align:right;padding:6px;border:1px solid #ddd;">Amount</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p style="margin-top:12px"><strong>Total: ₹${sub.toFixed(2)}</strong></p>
  <p style="font-size:12px;color:#666">This is an automated message. Please do not reply unless you have been asked to.</p>
</body></html>`;
}

function buildPlainTextFromDoc(doc) {
  const inv = doc.invoice || {};
  const lines = [
    `Sales invoice ${inv.invoice_number || ""}`,
    `Customer: ${inv.customer_name || ""}`,
    `Date: ${String(inv.invoice_date || "").slice(0, 10)}`,
    `Total: ₹${n(inv.total_amount).toFixed(2)}`
  ];
  (doc.items || []).forEach((l) => {
    lines.push(`- ${l.product_name || l.product_code || ""}  Qty ${n(l.qty)}  Line ₹${n(l.line_total).toFixed(2)}`);
  });
  return lines.join("\n");
}

module.exports = { buildSalesInvoiceEmailHtml, buildPlainTextFromDoc, escapeHtml };
