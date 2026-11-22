import { apiPost } from "./apiClient.js";
import { uploadToPresignedUrl } from "./uploadClient.js";
import { compressImageFile } from "../utils/compressImage.js";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const i = result.indexOf(",");
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export async function presignUpload({ docType, file }, opts) {
  return await apiPost(
    "/uploads/presign",
    {
      docType,
      contentType: file?.type || "",
      originalName: file?.name || ""
    },
    opts
  );
}

/** Compress → server put to S3 (preferred). Falls back to legacy presign PUT if put is unavailable. */
export async function uploadRegistrationDocViaPresign({ docType, file }, opts) {
  let ready = file;
  try {
    ready = await compressImageFile(file);
  } catch {
    ready = file;
  }

  // Preferred: server-side put (S3 / MinIO) with second-pass compression
  try {
    const contentBase64 = await fileToBase64(ready);
    const put = await apiPost(
      "/uploads/put",
      {
        docType,
        contentType: ready?.type || file?.type || "",
        originalName: ready?.name || file?.name || "",
        contentBase64
      },
      opts
    );
    if (put.status >= 200 && put.status < 300 && put.json?.ok) {
      const data = put.json?.data || {};
      return { ok: true, fileUrl: data.fileUrl, key: data.key };
    }
    // If put route missing (404), fall through to presign
    if (put.status !== 404 && put.status !== 405) {
      const msg = put.json?.error?.message || put.json?.error?.subMessage || "Upload failed.";
      return { ok: false, error: msg };
    }
  } catch {
    /* fall through */
  }

  const pres = await presignUpload({ docType, file: ready }, opts);
  if (!(pres.status >= 200 && pres.status < 300 && pres.json?.ok)) {
    const msg = pres.json?.error?.message || pres.json?.error?.subMessage || "Failed to start upload.";
    return { ok: false, error: msg };
  }
  const data = pres.json?.data || {};
  const up = await uploadToPresignedUrl({ uploadUrl: data.uploadUrl, file: ready });
  if (!up.ok) return { ok: false, error: "Upload failed. Please try again." };
  return { ok: true, fileUrl: data.fileUrl, key: data.key };
}

export async function registerUser(payload) {
  return await apiPost("/registration", payload);
}

/** Signed GET URL for the current user’s registration docs (private buckets). */
export async function resolveStoredDocumentUrl(fileUrl, opts) {
  const r = await apiPost("/uploads/access-url", { fileUrl: String(fileUrl || "").trim() }, opts);
  if (r.status >= 200 && r.status < 300 && r.json?.ok) return String(r.json?.data?.downloadUrl || "").trim() || null;
  return null;
}
