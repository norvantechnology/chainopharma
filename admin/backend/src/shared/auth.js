const { fail } = require("./response");
const { verifyAccessToken } = require("./tokens");

function getBearerToken(event) {
  const h = event?.headers || {};
  const raw = h.authorization || h.Authorization || "";
  const s = String(raw || "");
  if (!s.toLowerCase().startsWith("bearer ")) return "";
  return s.slice(7).trim();
}

function requireAdmin(event) {
  const token = getBearerToken(event);
  if (!token) return { ok: false, resp: fail(401, "UNAUTHORIZED", "Missing access token") };
  try {
    const claims = verifyAccessToken(token);
    if (String(claims?.role || "").toUpperCase() !== "ADMIN") {
      return { ok: false, resp: fail(403, "FORBIDDEN", "Admin access required") };
    }
    return { ok: true, claims };
  } catch {
    return { ok: false, resp: fail(401, "UNAUTHORIZED", "Invalid or expired access token") };
  }
}

module.exports = { requireAdmin };

