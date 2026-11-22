export async function uploadToPresignedUrl({ uploadUrl, file }) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": file.type || "application/octet-stream"
    },
    body: file
  });
  return { ok: res.ok, status: res.status };
}

