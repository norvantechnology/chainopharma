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
    const res = await pool.query(
      `
      select
        u.*,
        coalesce(r.name, '') as role,
        (u.id = u.account_id) as is_account_owner,
        case when u.id <> u.account_id then u.account_id else null end as parent_user_id,
        parent.full_name as parent_name,
        parent.email as parent_email,
        coalesce(ur.name, '') as custom_role_name
      from app_users u
      left join roles r on r.id = u.role_id
      left join app_users parent on parent.id = u.account_id and u.id <> u.account_id
      left join user_role_members urm on urm.user_id = u.id
      left join user_roles ur on ur.id = urm.role_id
      where u.id = $1
      limit 1
      `,
      [userId]
    );
    if (!res.rowCount) return fail(404, "NOT_FOUND", "User not found.");
    return ok({ user: res.rows[0] }, null);
  } catch {
    return fail(500, "DB_ERROR", "Failed to load user.");
  }
}

module.exports = { handler };

