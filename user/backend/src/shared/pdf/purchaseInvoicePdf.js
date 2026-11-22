const { pdfToBuffer } = require("./pdfBuffer");
const { n, inr } = require("./money");
const { safeFilePart } = require("./money");

function ymd(v) {
  return String(v || "").slice(0, 10);
}

function ensureSpace(pdf, y, needed) {
  const bottomLimit = pdf.page.height - pdf.page.margins.bottom;
  if (y + needed <= bottomLimit) return y;
  pdf.addPage();
  return pdf.page.margins.top;
}

function drawTableHeader(pdf, left, top, widths) {
  const [w1, w2, w3, w4] = widths;
  const h = 22;
  pdf.save();
  pdf.rect(left, top, w1 + w2 + w3 + w4, h).fill("#f6f7fb");
  pdf.restore();
  pdf.strokeColor("#d6d9e6").rect(left, top, w1 + w2 + w3 + w4, h).stroke();
  pdf.strokeColor("#d6d9e6").moveTo(left + w1, top).lineTo(left + w1, top + h).stroke();
  pdf.strokeColor("#d6d9e6").moveTo(left + w1 + w2, top).lineTo(left + w1 + w2, top + h).stroke();
  pdf.strokeColor("#d6d9e6").moveTo(left + w1 + w2 + w3, top).lineTo(left + w1 + w2 + w3, top + h).stroke();

  pdf.font("Helvetica-Bold").fontSize(9).fillColor("#333");
  pdf.text("Item", left + 8, top + 6, { width: w1 - 16 });
  pdf.text("Qty", left + w1 + 4, top + 6, { width: w2 - 8, align: "right" });
  pdf.text("Rate", left + w1 + w2 + 4, top + 6, { width: w3 - 8, align: "right" });
  pdf.text("Amount", left + w1 + w2 + w3 + 4, top + 6, { width: w4 - 8, align: "right" });
  return top + h;
}

/**
 * @param {object} doc — from getPurchaseInvoicePrintDoc
 * @returns {Promise<{ buffer: Buffer; filename: string }>}
 */
async function buildPurchaseInvoicePdfAttachment(doc) {
  const inv = doc.invoice || {};
  const seller = doc.seller || {};
  const items = doc.items || [];
  const party = [inv.division_label || inv.division_name, inv.division_mfg_name ? `(${inv.division_mfg_name})` : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  const partyLine = party || inv.vendor_name || "";

  const buffer = await pdfToBuffer((pdf) => {
    const left = pdf.page.margins.left;
    const right = pdf.page.width - pdf.page.margins.right;
    const usable = right - left;

    pdf.font("Helvetica-Bold").fontSize(16).fillColor("#111").text(String(seller.firm_name || seller.full_name || "Purchase").slice(0, 120), left, pdf.y, {
      width: usable
    });
    pdf.moveDown(0.2);
    const sellerLine = [seller.address, seller.phone_number, seller.gst_number ? `GST: ${seller.gst_number}` : ""].filter(Boolean).join("  |  ");
    if (sellerLine) pdf.font("Helvetica").fontSize(9).fillColor("#555").text(String(sellerLine).slice(0, 220), { width: usable });
    pdf.moveDown(0.6);

    pdf.font("Helvetica-Bold").fontSize(12).fillColor("#2a2a2a").text("Purchase Invoice", left, pdf.y, { width: usable });
    pdf.moveDown(0.4);

    pdf.font("Helvetica").fontSize(10).fillColor("#000");
    pdf.text(`Invoice no.: ${inv.invoice_number || ""}`);
    const extRef = inv.vendor_invoice_number ? `Supplier ref.: ${inv.vendor_invoice_number}` : "";
    if (extRef) pdf.text(extRef);
    pdf.text(`Party: ${partyLine}`);
    pdf.text(`Date: ${ymd(inv.invoice_date)}`);
    pdf.text(`Status: ${String(inv.status || "")}`);
    pdf.moveDown(0.8);

    const wItem = Math.floor(usable * 0.52);
    const wQty = Math.floor(usable * 0.12);
    const wRate = Math.floor(usable * 0.16);
    const wAmt = usable - wItem - wQty - wRate;
    let y = ensureSpace(pdf, pdf.y, 42);
    y = drawTableHeader(pdf, left, y, [wItem, wQty, wRate, wAmt]);
    const rowH = 20;

    pdf.font("Helvetica").fontSize(9).fillColor("#111");
    for (let i = 0; i < items.length; i++) {
      const line = items[i] || {};
      y = ensureSpace(pdf, y, rowH + 18);
      const top = y;
      const name = String(line.product_name || line.product_code || "").trim() || "-";
      const qty = String(n(line.qty));
      const rate = inr(line.purchase_rate ?? 0);
      const amt = inr(line.line_amount != null ? line.line_amount : line.taxable_amount);

      pdf.strokeColor("#e3e6f0").rect(left, top, wItem + wQty + wRate + wAmt, rowH).stroke();
      pdf.strokeColor("#e3e6f0").moveTo(left + wItem, top).lineTo(left + wItem, top + rowH).stroke();
      pdf.strokeColor("#e3e6f0").moveTo(left + wItem + wQty, top).lineTo(left + wItem + wQty, top + rowH).stroke();
      pdf.strokeColor("#e3e6f0").moveTo(left + wItem + wQty + wRate, top).lineTo(left + wItem + wQty + wRate, top + rowH).stroke();

      pdf.text(name.slice(0, 120), left + 8, top + 6, { width: wItem - 16 });
      pdf.text(qty, left + wItem + 4, top + 6, { width: wQty - 8, align: "right" });
      pdf.text(rate, left + wItem + wQty + 4, top + 6, { width: wRate - 8, align: "right" });
      pdf.text(amt, left + wItem + wQty + wRate + 4, top + 6, { width: wAmt - 8, align: "right" });

      y += rowH;
    }

    y = ensureSpace(pdf, y + 12, 80);
    const boxW = Math.min(260, usable);
    const boxX = right - boxW;
    pdf.strokeColor("#d6d9e6").rect(boxX, y, boxW, 52).stroke();
    pdf.font("Helvetica").fontSize(10).fillColor("#333").text("Total", boxX + 12, y + 12, { width: boxW - 24 });
    pdf.font("Helvetica-Bold").fontSize(12).fillColor("#111").text(inr(inv.total_amount), boxX + 12, y + 10, {
      width: boxW - 24,
      align: "right"
    });

    pdf.moveDown(2);
    pdf.font("Helvetica").fontSize(8).fillColor("#666").text("This is an automated message. Please do not reply unless you have been asked to.", left, pdf.y, {
      width: usable
    });
  });
  const filename = `Purchase-Invoice-${safeFilePart(inv.invoice_number)}.pdf`;
  return { buffer, filename };
}

module.exports = { buildPurchaseInvoicePdfAttachment };
