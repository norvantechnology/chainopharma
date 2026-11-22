/**
 * Single place for admin-visible product name and storage namespace.
 * Override at build time via VITE_APP_DISPLAY_NAME, VITE_APP_DOCUMENT_TITLE, VITE_APP_STORAGE_NS.
 */

function envTrim(key) {
  try {
    if (typeof import.meta === "undefined" || !import.meta.env) return "";
    return String(import.meta.env[key] ?? "").trim();
  } catch {
    return "";
  }
}

export const APP_DISPLAY_NAME = envTrim("VITE_APP_DISPLAY_NAME") || "Chaino Pharma";

export const APP_DOCUMENT_TITLE =
  envTrim("VITE_APP_DOCUMENT_TITLE") || `${APP_DISPLAY_NAME} Admin`;

const rawNs = envTrim("VITE_APP_STORAGE_NS")
  .replace(/[^a-z0-9_-]/gi, "")
  .toLowerCase();

export const APP_STORAGE_NS = rawNs || "chainopharma";

export function sidebarCollapsedStorageKey(variant) {
  return `${APP_STORAGE_NS}_${variant}_sb_collapsed`;
}
