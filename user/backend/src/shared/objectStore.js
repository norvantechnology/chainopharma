const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getS3Client, getBucket, getS3Region, getPublicBaseUrl } = require("./s3Client");

function storageMode() {
  const m = String(process.env.S3_STORAGE || "").trim().toLowerCase();
  if (m === "local" || m === "disk") return "local";
  if (m === "s3" || m === "minio") return "s3";
  // Auto: use local disk when endpoint points at loopback without a reachable S3, or S3_STORAGE unset + no credentials for cloud
  if (String(process.env.S3_ENDPOINT || "").includes("127.0.0.1") && !process.env.S3_FORCE_REMOTE) {
    // Prefer local filesystem companion to /media nginx alias when MinIO/S3 is not available
    if (String(process.env.S3_USE_LOCAL_DISK || "1") === "1") return "local";
  }
  return "s3";
}

function localRoot() {
  return String(process.env.S3_LOCAL_ROOT || "/var/lib/chainopharma/uploads").trim();
}

function publicUrlForKey(key) {
  const base = getPublicBaseUrl();
  if (base) return `${base.replace(/\/+$/, "")}/${String(key).replace(/^\/+/, "")}`;
  const bucket = getBucket();
  const region = getS3Region();
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
}

async function putObject({ key, body, contentType }) {
  const mode = storageMode();
  if (mode === "local") {
    const root = localRoot();
    const full = path.join(root, key);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, body);
    return { key, fileUrl: publicUrlForKey(key), mode: "local" };
  }

  const s3 = getS3Client();
  const bucket = getBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
      CacheControl: "public, max-age=31536000"
    })
  );
  return { key, fileUrl: publicUrlForKey(key), mode: "s3" };
}

async function getAccessUrl(key, expiresIn = 300) {
  const mode = storageMode();
  if (mode === "local") {
    // Public nginx /media/ — no signing needed
    return publicUrlForKey(key);
  }
  const s3 = getS3Client();
  const bucket = getBucket();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, cmd, { expiresIn });
}

function localFileExists(key) {
  try {
    return fs.existsSync(path.join(localRoot(), key));
  } catch {
    return false;
  }
}

module.exports = {
  storageMode,
  localRoot,
  publicUrlForKey,
  putObject,
  getAccessUrl,
  localFileExists
};
