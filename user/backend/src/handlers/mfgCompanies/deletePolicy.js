const { ok, fail } = require("../../shared/response");
const { query } = require("../../shared/db");
const { requirePermission } = require("../../shared/auth");
const { getPermissionsForUser } = require("../../shared/permissions");
const { MFG_COMPANY_COLUMNS } = require("../../shared/mfgCompanyInput");

function getPathParam(event, name) {
  return (
    event?.pathParameters?.[name] ||
    event?.pathParameters?.[name?.toLowerCase?.()] ||
    event?.pathParameters?.[name?.toUpperCase?.()] ||
    ""
  );
}

async function handler(event) {
  const auth = await requirePermission(event, "MFG_COMPANIES", "UPDATE");
  if (!auth.ok) return auth.resp;

  const actorId = String(auth.claims?.sub || "");
  const ctx = await getPermissionsForUser(actorId);
  if (!ctx.accountId) return fail(400, "BAD_REQUEST", "account not found");

  const id = String(getPathParam(event, "id") || "").trim();
  if (!id) return fail(400, "VALIDATION_ERROR", "id is required");

  const curRes = await query(
    `SELECT id FROM mfg_companies WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [id, ctx.accountId]
  );
  if (!curRes.rows[0]) return fail(404, "NOT_FOUND", "Company not found.");

  const upd = await query(
    `
    UPDATE mfg_companies
    SET
      sale_lock = false,
      purchase_order_lock = false,
      stock_report_lock = false,
      prevent_free_qty = false,
      prevent_discount = false,
      prevent_net_rate = false,
      prevent_return_product = false,
      prevent_expiry_damage_product = false,
      out_bill_limit = 0,
      out_day_limit = 0,
      credit_limit = 0,
      updated_at = now()
    WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL
    RETURNING ${MFG_COMPANY_COLUMNS}
    `,
    [id, ctx.accountId]
  );

  return ok(
    { company: upd.rows[0] || null },
    {
      message: "Policy cleared.",
      subMessage: "All locks, restrictions, and financial limits have been removed for this manufacturer."
    }
  );
}

module.exports = { handler };
