const { ok, fail } = require("../../shared/response");
const { query } = require("../../shared/db");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { sendMail } = require("../../shared/mailOut");
const { buildCustomerLedgerDoc } = require("./ledgerDoc");
const { buildCustomerLedgerPdfAttachment } = require("../../shared/pdf/customerLedgerPdf");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

async function handler(event) {
  const auth = await requirePermission(event, "CUSTOMERS", "VIEW");
  if (!auth.ok) return auth.resp;
  const actorId = String(auth.claims?.sub || "");
  const customerId = String(event?.pathParameters?.id || "");
  const ctx = await getPermissionsForUser(actorId);
  if (!ctx.accountId) return fail(400, "BAD_REQUEST", "account not found");
  if (!customerId) return fail(400, "VALIDATION_ERROR", "customer id is required");

  let doc;
  try {
    doc = await buildCustomerLedgerDoc({ accountId: ctx.accountId, customerId });
  } catch {
    return fail(500, "INTERNAL_ERROR", "Something went wrong.", { subMessage: "Please try again." });
  }
  if (!doc) return fail(404, "NOT_FOUND", "Customer not found");

  const cust = doc.customer;
  const to = cleanEmail(cust.email);
  if (!to || !EMAIL_RE.test(to)) {
    return ok({
      results: [{ status: "no_email", customerId: cust.id, customerName: cust.name || "" }]
    });
  }

  const sellerRs = await query(
    `SELECT
       u.id,
       u.full_name,
       COALESCE(to_jsonb(u) ->> 'firm_name', '') AS firm_name
     FROM app_users u
     WHERE u.id = $1
     LIMIT 1`,
    [ctx.accountId]
  );
  const seller = sellerRs.rows?.[0] || null;

  let attachment;
  try {
    attachment = await buildCustomerLedgerPdfAttachment({ ...doc, seller });
  } catch (e) {
    return fail(500, "INTERNAL_ERROR", "PDF generation failed.", { subMessage: String(e?.message || "") });
  }

  const subject = `Customer ledger  ${cust.name || "Customer"}`.trim();
  const text = `Please find your customer ledger statement attached as a PDF.\n\n— ${seller?.firm_name || seller?.full_name || ""}`;
  const m = await sendMail({
    to,
    subject,
    text,
    attachments: [{ filename: attachment.filename, content: attachment.buffer, contentType: "application/pdf" }]
  });

  if (m.ok) {
    return ok({ results: [{ status: m.dryRun ? "sent_dry_run" : "sent", to }] }, { message: "Ledger emailed." });
  }
  return ok({ results: [{ status: "send_failed", message: m.error || "Send failed" }] });
}

module.exports = { handler };
