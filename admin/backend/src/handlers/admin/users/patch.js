const { requireAdmin } = require("../../../shared/auth");
const { ok, fail } = require("../../../shared/response");
const { getPool } = require("../../../shared/db");
const { parseJsonBody } = require("../../../shared/request");

function getUserIdFromPath(event) {
  const p = String(event?.path || "");
  const m = p.match(/\/admin\/users\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : "";
}

function optText(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

async function handler(event) {
  const auth = requireAdmin(event);
  if (!auth.ok) return auth.resp;

  const userId = getUserIdFromPath(event);
  if (!userId) return fail(400, "VALIDATION", "Missing user id.");

  const parsed = parseJsonBody(event);
  if (!parsed.ok) return fail(400, "BAD_JSON", "Invalid JSON body.");

  const body = parsed.value || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  const pool = getPool();

  if (has("role_id")) {
    return fail(403, "FORBIDDEN", "Changing a user's system role is not allowed.");
  }

  const updates = [];
  const params = [];

  if (has("full_name")) {
    const v = optText(body.full_name);
    if (!v) return fail(400, "VALIDATION", "Full name cannot be empty.");
    params.push(v);
    updates.push(`full_name = $${params.length}`);
  }

  if (has("email")) {
    const v = optText(body.email);
    if (!v) return fail(400, "VALIDATION", "Email cannot be empty.");
    if (!isValidEmail(v)) return fail(400, "VALIDATION", "Invalid email address.");
    params.push(v.toLowerCase());
    updates.push(`email = $${params.length}`);
  }

  if (has("phone_country_code") || has("phone_number")) {
    const cc = has("phone_country_code") ? optText(body.phone_country_code) : undefined;
    const pn = has("phone_number") ? optText(body.phone_number) : undefined;
    if (cc === undefined || pn === undefined) {
      return fail(400, "VALIDATION", "Provide both phone_country_code and phone_number together.");
    }
    if (!cc || !pn) return fail(400, "VALIDATION", "Phone country code and number cannot be empty.");
    params.push(cc);
    updates.push(`phone_country_code = $${params.length}`);
    params.push(pn);
    updates.push(`phone_number = $${params.length}`);
  }

  const textCols = [
    "firm_name",
    "address",
    "pin_code",
    "city",
    "state",
    "gst_number",
    "drug_license_1_number",
    "drug_license_2_number",
    "gst_certificate_url",
    "drug_license_1_url",
    "drug_license_2_url"
  ];
  for (const col of textCols) {
    if (has(col)) {
      const v = optText(body[col]);
      params.push(v);
      updates.push(`${col} = $${params.length}`);
    }
  }

  if (has("is_blocked")) {
    params.push(Boolean(body.is_blocked));
    updates.push(`is_blocked = $${params.length}`);
  }

  if (!updates.length) return fail(400, "VALIDATION", "No fields to update.");

  params.push(userId);

  try {
    const sql = `
      update app_users
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning id
    `;
    const res = await pool.query(sql, params);
    if (!res.rowCount) return fail(404, "NOT_FOUND", "User not found.");
    return ok({ id: res.rows[0].id }, { message: "User updated." });
  } catch (e) {
    if (e && e.code === "23505") {
      return fail(409, "CONFLICT", "Email or phone number is already in use.");
    }
    return fail(500, "DB_ERROR", "Failed to update user.");
  }
}

module.exports = { handler };
