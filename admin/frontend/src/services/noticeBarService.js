import { apiGet, apiPut } from "./apiClient.js";

export async function getNoticeBar(opts) {
  return await apiGet("/admin/announcement", { ...opts, toast: opts?.toast ?? "none" });
}

export async function saveNoticeBar(body, opts) {
  return await apiPut("/admin/announcement", body, opts);
}
