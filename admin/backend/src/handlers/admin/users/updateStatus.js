const { requireAdmin } = require("../../../shared/auth");
const { ok, fail } = require("../../../shared/response");
const { parseJsonBody } = require("../../../shared/request");
const { getPool } = require("../../../shared/db");

function getUserIdFromPath(event) {
  const p = String(event?.path || "");
  const m = p.match(/\/admin\/users\/([^/]+)\/status$/);
  return m ? decodeURIComponent(m[1]) : "";
}

function normalizeStatus(s) {
  const v = String(s || "").trim().toUpperCase();
  if (v === "PENDING" || v === "APPROVED" || v === "REJECTED") return v;
  return "";
}

async function handler(event) {
  const auth = requireAdmin(event);
  if (!auth.ok) return auth.resp;

  const userId = getUserIdFromPath(event);
  if (!userId) return fail(400, "VALIDATION", "Missing user id.");

  const parsed = parseJsonBody(event);
  if (!parsed.ok) return fail(400, "BAD_JSON", "Invalid JSON body.");

  const status = normalizeStatus(parsed.value?.status);
  if (!status) return fail(400, "VALIDATION", "Invalid status. Use PENDING/APPROVED/REJECTED.");

  const pool = getPool();
  try {
    const res = await pool.query(`update app_users set status = $1 where id = $2 returning id, status`, [status, userId]);
    if (!res.rowCount) return fail(404, "NOT_FOUND", "User not found.");
    return ok({ id: res.rows[0].id, status: res.rows[0].status }, { message: "User status updated." });
  } catch {
    return fail(500, "DB_ERROR", "Failed to update status.");
  }
}

module.exports = { handler };

