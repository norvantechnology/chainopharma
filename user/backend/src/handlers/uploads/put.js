const crypto = require("crypto");
const { ok, fail } = require("../../shared/response");
const { parseJsonBody } = require("../../shared/request");
const { getBucket, getS3Region } = require("../../shared/s3Client");
const { compressImageBuffer } = require("../../shared/imageCompress");
const { putObject } = require("../../shared/objectStore");

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);
const ALLOWED_DOC_TYPES = new Set(["GST_CERTIFICATE", "DRUG_LICENSE_1", "DRUG_LICENSE_2"]);
const MAX_BYTES = 8 * 1024 * 1024;

function safeBaseName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function handler(event) {
  try {
    const body = parseJsonBody(event);
    const docType = String(body.docType || "").trim().toUpperCase();
    let contentType = String(body.contentType || "").trim().toLowerCase();
    const originalName = String(body.originalName || "").trim();
    const contentBase64 = String(body.contentBase64 || "").trim();

    if (!docType) return fail(400, "VALIDATION_ERROR", "docType is required");
    if (!ALLOWED_DOC_TYPES.has(docType)) return fail(400, "VALIDATION_ERROR", "docType is invalid");
    if (!contentType) return fail(400, "VALIDATION_ERROR", "contentType is required");
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) return fail(400, "VALIDATION_ERROR", "contentType is not allowed");
    if (!contentBase64) return fail(400, "VALIDATION_ERROR", "contentBase64 is required");

    const bucket = getBucket();
    const region = getS3Region();
    if (!bucket || !region) {
      return fail(503, "SERVICE_UNAVAILABLE", "File uploads are not configured (missing S3 bucket or region).");
    }

    let buffer = Buffer.from(contentBase64, "base64");
    if (!buffer.length) return fail(400, "VALIDATION_ERROR", "File content is empty");
    if (buffer.length > MAX_BYTES) return fail(400, "VALIDATION_ERROR", "File is too large (max 8MB).");

    if (contentType !== "image/gif") {
      const compressed = await compressImageBuffer(buffer, contentType);
      buffer = compressed.buffer;
      contentType = compressed.contentType;
    }

    const ext =
      contentType === "image/png"
        ? "png"
        : contentType === "image/gif"
          ? "gif"
          : contentType === "image/webp"
            ? "webp"
            : "jpg";

    const id = crypto.randomUUID();
    const namePart = safeBaseName(originalName || docType);
    const key = `user-registration/${docType}/${id}-${namePart || docType}.${ext}`;

    const stored = await putObject({ key, body: buffer, contentType });

    return ok(
      {
        docType,
        key: stored.key,
        fileUrl: stored.fileUrl,
        contentType,
        size: buffer.length,
        storage: stored.mode
      },
      { message: "File uploaded." }
    );
  } catch (e) {
    if (e && e.code === "MISSING_ENV") {
      return fail(500, "SERVER_MISCONFIG", `Server misconfigured: ${e.message}`, e.details);
    }
    console.error("[uploads/put]", e);
    return fail(500, "SERVER_ERROR", "Failed to upload file");
  }
}

module.exports = { handler };
