/**
 * Compress an image File in the browser (canvas) before upload.
 * Keeps non-images unchanged. Returns a new File (usually JPEG/WebP).
 */
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.72;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

function isImageFile(file) {
  const t = String(file?.type || "").toLowerCase();
  return t.startsWith("image/") && t !== "image/svg+xml" && t !== "image/gif";
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Image compression failed."));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

export async function compressImageFile(file, opts = {}) {
  if (!file || !isImageFile(file)) return file;

  const maxEdge = Number(opts.maxEdge || DEFAULT_MAX_EDGE);
  const quality = Number(opts.quality ?? DEFAULT_QUALITY);
  const maxBytes = Number(opts.maxBytes || DEFAULT_MAX_BYTES);

  // Already small enough — still lightly recompress huge dimensions
  const img = await loadImageFromFile(file);
  let { width, height } = img;
  if (!width || !height) return file;

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const preferWebp = typeof canvas.toDataURL === "function";
  let outType = "image/jpeg";
  let blob = await canvasToBlob(canvas, outType, quality);

  // Try WebP if smaller
  if (preferWebp) {
    try {
      const webp = await canvasToBlob(canvas, "image/webp", quality);
      if (webp && webp.size < blob.size) {
        blob = webp;
        outType = "image/webp";
      }
    } catch {
      /* keep jpeg */
    }
  }

  // If still over max, step quality down
  let q = quality;
  while (blob.size > maxBytes && q > 0.4) {
    q -= 0.1;
    blob = await canvasToBlob(canvas, outType, q);
  }

  // Prefer compressed only when smaller (or dimensions were reduced)
  if (blob.size >= file.size && scale >= 1) return file;

  const base = String(file.name || "image").replace(/\.[^.]+$/, "");
  const ext = outType === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${base}.${ext}`, { type: outType, lastModified: Date.now() });
}
