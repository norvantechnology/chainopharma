const bcrypt = require("bcryptjs");
const { json } = require("../../shared/http");
const { ok, fail } = require("../../shared/response");
const { parseJsonBody } = require("../../shared/request");
const { isEmailLike } = require("../../shared/validation");
const { getPool } = require("../../shared/db");
const { newRefreshToken, signAccessToken } = require("../../shared/tokens");

async function handler(event) {
  if (event?.httpMethod === "OPTIONS") return json(204, {});

  const parsed = parseJsonBody(event);
  if (!parsed.ok) return json(400, fail("BAD_JSON", "Invalid JSON body."));

  const email = String(parsed.value?.email || "").trim().toLowerCase();
  const password = String(parsed.value?.password || "");

  if (!isEmailLike(email)) return fail(400, "VALIDATION", "Enter a valid email address.", { fieldErrors: { email: "Invalid email." } });
  if (!password) return fail(400, "VALIDATION", "Password is required.", { fieldErrors: { password: "Password is required." } });

  let r;
  try {
    const pool = getPool();
    r = await pool.query(
      `select id, email, password_hash, full_name, is_active, created_at
       from admin_user
       where email = $1
       limit 1`,
      [email]
    );
  } catch (e) {
    return fail(500, "DB_ERROR", "Database connection failed. Please try again later.");
  }

  if (!r.rowCount) return fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");

  const row = r.rows[0];
  if (row.is_active === false) return fail(403, "ADMIN_DISABLED", "Your admin account is disabled.");

  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) return fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");

  const t = signAccessToken({ sub: row.id, email: row.email });
  const refreshToken = newRefreshToken();

  return ok(
    {
      user: {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        created_at: row.created_at
      },
      tokens: {
        ...t,
        refreshToken,
        refreshExpiresInSec: Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 86400),
        rememberMe: false
      }
    },
    { message: "Login successful." }
  );
}

module.exports = { handler };

