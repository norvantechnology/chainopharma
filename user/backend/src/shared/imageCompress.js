/**
 * Server-side image compression via sharp (optional dependency).
 * Falls back to original buffer if sharp is unavailable.
 */
let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

async function compressImageBuffer(buffer, contentType) {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const type = String(contentType || "").toLowerCase();

  if (!sharp || !input.length) {
    return { buffer: input, contentType: type || "application/octet-stream" };
  }

  try {
    const maxEdge = 1600;
    const meta = await sharp(input, { failOn: "none" }).metadata();
    const needsResize = (meta.width || 0) > maxEdge || (meta.height || 0) > maxEdge;

    const base = () => {
      let p = sharp(input, { failOn: "none" }).rotate();
      if (needsResize) {
        p = p.resize({
          width: maxEdge,
          height: maxEdge,
          fit: "inside",
          withoutEnlargement: true
        });
      }
      return p;
    };

    let out;
    let outType;
    try {
      out = await base().webp({ quality: 72, effort: 4 }).toBuffer();
      outType = "image/webp";
    } catch {
      out = await base().jpeg({ quality: 72, mozjpeg: true }).toBuffer();
      outType = "image/jpeg";
    }

    if (out.length < input.length || needsResize || outType !== type) {
      return { buffer: out, contentType: outType };
    }
    return { buffer: input, contentType: type };
  } catch (e) {
    console.warn("[imageCompress] fallback to original:", e.message);
    return { buffer: input, contentType: type || "application/octet-stream" };
  }
}

module.exports = { compressImageBuffer };
