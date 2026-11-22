import { apiPost } from "./apiClient.js";

export function adminLogin({ email, password }) {
  return apiPost("/auth/login", { email, password }, { toast: "none" });
}

