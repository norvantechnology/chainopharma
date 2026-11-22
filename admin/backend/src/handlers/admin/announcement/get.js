const { requireAdmin } = require("../../../shared/auth");
const { ok, fail } = require("../../../shared/response");
const { getPool } = require("../../../shared/db");
const { ensurePlatformAnnouncementTable } = require("../../../shared/platformAnnouncementTable");

const DEFAULTS = {
  enabled: false,
  messageText: "",
  backgroundColor: "#e0f2fe",
  textColor: "#0c4a6e",
  buttonLabel: "",
  buttonUrl: "",
  updatedAt: null
};

async function handler(event) {
  const auth = requireAdmin(event);
  if (!auth.ok) return auth.resp;

  const pool = getPool();
  try {
    const res = await pool.query(
      `
      SELECT enabled, message_text, background_color, text_color, button_label, button_url, updated_at
      FROM platform_announcement
      WHERE id = 1
      LIMIT 1
      `
    );

    const row = res.rows[0];
    if (!row) {
      return ok({ announcement: { ...DEFAULTS } });
    }

    return ok({
      announcement: {
        enabled: Boolean(row.enabled),
        messageText: String(row.message_text || ""),
        backgroundColor: String(row.background_color || DEFAULTS.backgroundColor),
        textColor: String(row.text_color || DEFAULTS.textColor),
        buttonLabel: String(row.button_label || ""),
        buttonUrl: String(row.button_url || ""),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[admin announcement get]", e);
    const pgMsg = String(e?.message || e);
    const pgCode = e?.code;
    return fail(500, "DB_ERROR", "Failed to load notice bar.", {
      pgCode: pgCode || undefined,
      pgMessage: pgMsg
    });
  }
}

module.exports = { handler };
