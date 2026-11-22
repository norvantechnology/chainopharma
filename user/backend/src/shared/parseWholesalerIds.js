function clean(v) {
  return String(v ?? "").trim();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse wholesaler id list from query / multiValue query.
 * Accepts comma-separated strings or repeated keys / arrays.
 */
function parseWholesalerIds(qs = {}, multi = {}) {
  const rawCandidates = [
    qs.wholesaler_ids,
    qs.wholesalerIds,
    qs.wholesaler_account_ids,
    qs.wholesalerAccountIds,
    qs.wholesaler_id,
    qs.wholesalerId,
    qs.wholesaler_account_id,
    qs.wholesalerAccountId,
    multi.wholesaler_ids,
    multi.wholesalerIds,
    multi.wholesaler_account_ids,
    multi.wholesalerAccountIds
  ];

  const out = [];
  for (const raw of rawCandidates) {
    if (raw == null || raw === "") continue;
    const parts = Array.isArray(raw) ? raw : String(raw).split(",");
    for (const p of parts) {
      const id = clean(p);
      if (id) out.push(id);
    }
  }
  return [...new Set(out)];
}

function invalidWholesalerIds(ids = []) {
  return (ids || []).filter((id) => !UUID_RE.test(String(id || "")));
}

module.exports = {
  parseWholesalerIds,
  invalidWholesalerIds,
  UUID_RE
};
