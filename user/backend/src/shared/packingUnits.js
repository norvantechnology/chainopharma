/**
 * Derive tablets-per-strip (packing_units) from a packing label.
 * Examples: "10" → 10, "10x10" / "10×10" → 10, "1x15" → 15.
 * Uses the last positive integer in the string (common strip size).
 */
function derivePackingUnits(packing, fallback = 10) {
  const fb = Math.max(1, Math.floor(Number(fallback) || 10));
  const s = String(packing ?? "").trim();
  if (!s) return fb;
  const nums = s.match(/\d+/g);
  if (!nums || !nums.length) return fb;
  const last = Number(nums[nums.length - 1]);
  if (!Number.isFinite(last) || last <= 0) return fb;
  return Math.max(1, Math.min(10000, Math.floor(last)));
}

module.exports = { derivePackingUnits };
