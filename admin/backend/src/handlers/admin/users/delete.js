const { requireAdmin } = require("../../../shared/auth");
const { ok, fail } = require("../../../shared/response");
const { getPool } = require("../../../shared/db");

function getUserIdFromPath(event) {
  const p = String(event?.path || "");
  const m = p.match(/\/admin\/users\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function handler(event) {
  const auth = requireAdmin(event);
  if (!auth.ok) return auth.resp;

  const userId = getUserIdFromPath(event);
  if (!userId) return fail(400, "VALIDATION", "Missing user id.");

  const pool = getPool();
  try {
    const res = await pool.query(`delete from app_users where id = $1 returning id`, [userId]);
    if (!res.rowCount) return fail(404, "NOT_FOUND", "User not found.");
    return ok({ id: res.rows[0].id }, { message: "User deleted." });
  } catch {
    return fail(500, "DB_ERROR", "Failed to delete user.");
  }
}

module.exports = { handler };

