function parseJsonBody(event) {
  try {
    if (!event || !event.body) return { ok: true, value: {} };
    const raw = typeof event.body === "string" ? event.body : String(event.body);
    if (!raw.trim()) return { ok: true, value: {} };
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

module.exports = { parseJsonBody };

