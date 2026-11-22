import { apiGet } from "./apiClient.js";

export function listRoles() {
  return apiGet("/admin/roles");
}

