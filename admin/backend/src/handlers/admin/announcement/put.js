const { requireAdmin } = require("../../../shared/auth");
const { ok, fail } = require("../../../shared/response");
const { getPool } = require("../../../shared/db");
const { parseJsonBody } = require("../../../shared/request");
const { ensurePlatformAnnouncementTable } = require("../../../shared/platformAnnouncementTable");

function cleanStr(v, max) {
  const s = String(v ?? "").trim();
  if (max && s.length > max) return s.slice(0, max);
  return s;
}

function isHexColor(s) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(s || "").trim());
}

function isAllowedUrl(s) {
  const u = String(s || "").trim();
  if (!u) return true;
  if (u.startsWith("/") && u.length <= 2048 && !/\s/.test(u)) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function handler(event) {
  const auth = requireAdmin(event);
  if (!auth.ok) return auth.resp;

  const parsed = parseJsonBody(event);
  if (!parsed.ok) return fail(400, "BAD_JSON", "Invalid JSON body.");
  const body = parsed.value || {};

  const enabled = Boolean(body.enabled);
  const messageText = cleanStr(body.messageText, 4000);
  const backgroundColor = cleanStr(body.backgroundColor, 32) || "#e0f2fe";
  const textColor = cleanStr(body.textColor, 32) || "#0c4a6e";
  const buttonLabel = cleanStr(body.buttonLabel, 120);
  const buttonUrl = cleanStr(body.buttonUrl, 2048);

  if (!isHexColor(backgroundColor)) return fail(400, "VALIDATION", "backgroundColor must be a hex color (e.g. #0ea5e9).");
  if (!isHexColor(textColor)) return fail(400, "VALIDATION", "textColor must be a hex color (e.g. #0f172a).");
  if (buttonLabel && !buttonUrl) return fail(400, "VALIDATION", "buttonUrl is required when buttonLabel is set.");
  if (buttonUrl && !buttonLabel) return fail(400, "VALIDATION", "buttonLabel is required when buttonUrl is set.");
  if (buttonUrl && !isAllowedUrl(buttonUrl)) return fail(400, "VALIDATION", "buttonUrl must be http(s) or a path starting with /.");

  const pool = getPool();
  try {
    await ensurePlatformAnnouncementTable();
    await pool.query(
      `
      INSERT INTO platform_announcement (
        id, enabled, message_text, background_color, text_color, button_label, button_url, updated_at
      ) VALUES (1, $1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        message_text = EXCLUDED.message_text,
        background_color = EXCLUDED.background_color,
        text_color = EXCLUDED.text_color,
        button_label = EXCLUDED.button_label,
        button_url = EXCLUDED.button_url,
        updated_at = now()
      `,
      [enabled, messageText, backgroundColor, textColor, buttonLabel, buttonUrl]
    );

    const res = await pool.query(
      `SELECT enabled, message_text, background_color, text_color, button_label, button_url, updated_at
       FROM platform_announcement WHERE id = 1 LIMIT 1`,
      []
    );
    const row = res.rows[0];
    return ok({
      announcement: {
        enabled: Boolean(row.enabled),
        messageText: String(row.message_text || ""),
        backgroundColor: String(row.background_color || ""),
        textColor: String(row.text_color || ""),
        buttonLabel: String(row.button_label || ""),
        buttonUrl: String(row.button_url || ""),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[admin announcement put]", e);
    const pgMsg = String(e?.message || e);
    const pgCode = e?.code;
    return fail(500, "DB_ERROR", "Failed to save notice bar.", {
      pgCode: pgCode || undefined,
      pgMessage: pgMsg
    });
  }
}

module.exports = { handler };
