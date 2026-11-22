function isEmailLike(email) {
  const v = String(email || "").trim().toLowerCase();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

module.exports = { isEmailLike };

