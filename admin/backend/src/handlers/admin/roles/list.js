const { requireAdmin } = require("../../../shared/auth");
const { ok, fail } = require("../../../shared/response");
const { getPool } = require("../../../shared/db");

async function handler(event) {
  const auth = requireAdmin(event);
  if (!auth.ok) return auth.resp;

  const pool = getPool();
  try {
    const res = await pool.query(`select id, code, name from roles order by id asc`);
    return ok({ roles: res.rows }, null);
  } catch {
    return fail(500, "DB_ERROR", "Failed to load roles.");
  }
}

module.exports = { handler };

