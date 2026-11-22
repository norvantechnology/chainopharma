function qStr(v) {
  return String(v == null ? "" : v).trim();
}

function qInt(v, fallback) {
  const n = Number.parseInt(String(v || ""), 10);
  if (Number.isFinite(n) && n >= 0) return n;
  return fallback;
}

module.exports = { qStr, qInt };

