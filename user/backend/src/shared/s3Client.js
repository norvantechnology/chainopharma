const { S3Client } = require("@aws-sdk/client-s3");
const { RequestChecksumCalculation } = require("@aws-sdk/middleware-flexible-checksums");

function missingEnv(name) {
  const e = new Error(`${name} is required`);
  e.code = "MISSING_ENV";
  e.details = { name };
  return e;
}

function getS3Region() {
  return String(process.env.S3_REGION || process.env.AWS_REGION || "").trim();
}

function getBucket() {
  return String(process.env.S3_BUCKET || "").trim();
}

/** Optional custom endpoint (MinIO / path-style gateway). */
function getS3Endpoint() {
  return String(process.env.S3_ENDPOINT || "").trim().replace(/\/+$/, "");
}

function getPublicBaseUrl() {
  return String(process.env.S3_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
}

function getS3Client() {
  const region = getS3Region();
  if (!region) throw missingEnv("S3_REGION or AWS_REGION");

  const endpoint = getS3Endpoint();
  const forcePathStyle =
    String(process.env.S3_FORCE_PATH_STYLE || (endpoint ? "1" : "")).trim() === "1";

  const accessKeyId = String(process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(
    process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || ""
  ).trim();

  /*
   * Default SDK behaviour is WHEN_SUPPORTED, which adds CRC32 query params to presigned PUT URLs.
   * Browsers cannot satisfy those reliably → S3 returns 403. WHEN_REQUIRED keeps SigV4 + UNSIGNED-PAYLOAD
   * uploads compatible with fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": … } }).
   */
  const cfg = {
    region,
    requestChecksumCalculation: RequestChecksumCalculation.WHEN_REQUIRED,
    forcePathStyle
  };
  if (endpoint) cfg.endpoint = endpoint;
  if (accessKeyId && secretAccessKey) {
    cfg.credentials = { accessKeyId, secretAccessKey };
  }

  return new S3Client(cfg);
}

module.exports = {
  getS3Client,
  getBucket,
  getS3Region,
  getS3Endpoint,
  getPublicBaseUrl,
  missingEnv
};
