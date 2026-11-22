const { requireAdmin } = require("../../../shared/auth");
const { ok, fail } = require("../../../shared/response");
const { getPool } = require("../../../shared/db");
const { qStr, qInt } = require("../../../shared/query");

async function handler(event) {
  const auth = requireAdmin(event);
  if (!auth.ok) return auth.resp;

  const q = event?.queryStringParameters || {};
  const search = qStr(q.search).toLowerCase();
  const roleId = qStr(q.roleId); // roles.id (smallint)
  const statusFilter = qStr(q.status).trim().toUpperCase();
  const userType = qStr(q.userType).trim().toLowerCase();
  const blockedFilter = qStr(q.blocked).trim().toLowerCase();
  const sortByRaw = qStr(q.sortBy).trim().toLowerCase();
  const sortDirRaw = qStr(q.sortDir).trim().toLowerCase();
  const limit = Math.min(qInt(q.limit, 25), 100);
  const offset = qInt(q.offset, 0);

  const SORT_SQL = {
    name: "u.full_name",
    email: "u.email",
    role: "lower(coalesce(r.name, ''))",
    phone: "lower(coalesce(u.phone_country_code, '') || coalesce(u.phone_number, ''))",
    status: "u.status",
    joined: "u.created_at"
  };
  const sortExpr = SORT_SQL[sortByRaw];
  const sortDir = sortDirRaw === "asc" ? "asc" : "desc";
  const orderSql = sortExpr ? `order by ${sortExpr} ${sortDir}` : "order by u.created_at desc";

  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(lower(u.full_name) like $${params.length} or lower(u.email) like $${params.length} or u.phone_number like $${params.length})`);
  }

  if (roleId) {
    const rid = Number.parseInt(roleId, 10);
    if (Number.isFinite(rid)) {
      params.push(rid);
      where.push(`u.role_id = $${params.length}`);
    }
  }

  if (statusFilter === "PENDING" || statusFilter === "APPROVED" || statusFilter === "REJECTED") {
    params.push(statusFilter);
    where.push(`u.status = $${params.length}`);
  }

  if (userType === "owner") {
    where.push(`u.id = u.account_id`);
  } else if (userType === "sub") {
    where.push(`u.id <> u.account_id`);
  }

  if (blockedFilter === "true" || blockedFilter === "1") {
    where.push(`u.is_blocked = true`);
  } else if (blockedFilter === "false" || blockedFilter === "0") {
    where.push(`u.is_blocked = false`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const pool = getPool();

  try {
    const countRes = await pool.query(
      `
      select count(*)::int as total
      from app_users u
      left join roles r on r.id = u.role_id
      ${whereSql}
      `,
      params
    );

    params.push(limit, offset);
    const rowsRes = await pool.query(
      `
      select
        u.id,
        u.full_name,
        u.email,
        coalesce(r.name, '') as role,
        u.phone_country_code,
        u.phone_number,
        u.status,
        u.is_blocked,
        u.email_verified,
        u.created_at,
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
      ${whereSql}
      ${orderSql}
      limit $${params.length - 1} offset $${params.length}
      `,
      params
    );

    return ok(
      {
        users: rowsRes.rows,
        total: countRes.rows?.[0]?.total || 0,
        limit,
        offset
      },
      null
    );
  } catch (e) {
    return fail(500, "DB_ERROR", "Failed to load users.");
  }
}

module.exports = { handler };

