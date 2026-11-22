/**
 * Single place for user-visible product name and storage namespace.
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
  envTrim("VITE_APP_DOCUMENT_TITLE") || `${APP_DISPLAY_NAME} User`;

const rawNs = envTrim("VITE_APP_STORAGE_NS")
  .replace(/[^a-z0-9_-]/gi, "")
  .toLowerCase();

/** Stable prefix for localStorage / sessionStorage keys (avoid spaces). */
export const APP_STORAGE_NS = rawNs || "chainopharma";

/** Previous prefixes; used only to migrate persisted UI state after rebrand. */
export const LEGACY_STORAGE_PREFIX = "medico";
const LEGACY_STORAGE_PREFIXES = ["medico", "jedmee"];

export function signInSubtitle() {
  return `Sign in to your ${APP_DISPLAY_NAME} account`;
}

export function csvImportMatchColumnsHint() {
  return `Match each file column to a ${APP_DISPLAY_NAME} field. Unmapped columns are ignored.`;
}

export function csvImportTemplatesHint() {
  return `Templates list every column ${APP_DISPLAY_NAME} understands. Use “Sample” to see example values (e.g. from Marg/KMS exports).`;
}

export function csvFieldColumnHeader() {
  return `${APP_DISPLAY_NAME} field`;
}

function migrateStorageKey(store, primary, suffix) {
  if (typeof window === "undefined" || !store) return primary;
  try {
    if (store.getItem(primary) != null) return primary;
    for (const prefix of LEGACY_STORAGE_PREFIXES) {
      const legacy = `${prefix}_${suffix}`;
      const old = store.getItem(legacy);
      if (old != null) {
        store.setItem(primary, old);
        store.removeItem(legacy);
        break;
      }
    }
  } catch {
    /* ignore */
  }
  return primary;
}

/** Sales billing defaults (customer / division last used). */
export function salesInvoiceDefaultsStorageKey() {
  return migrateStorageKey(typeof window !== "undefined" ? window.localStorage : null, `${APP_STORAGE_NS}_sales_invoice_defaults_v1`, "sales_invoice_defaults_v1");
}

/** Common table column visibility bucket root key. */
export function commonTableColsStorageRoot() {
  return migrateStorageKey(typeof window !== "undefined" ? window.localStorage : null, `${APP_STORAGE_NS}_common_table_cols_v1`, "common_table_cols_v1");
}

export function sidebarCollapsedStorageKey(variant) {
  return migrateStorageKey(
    typeof window !== "undefined" ? window.localStorage : null,
    `${APP_STORAGE_NS}_${variant}_sb_collapsed`,
    `${variant}_sb_collapsed`
  );
}

export function sidebarNavScrollStorageKey() {
  return migrateStorageKey(typeof window !== "undefined" ? window.sessionStorage : null, `${APP_STORAGE_NS}_sb_nav_scroll`, "sb_nav_scroll");
}

export function announcementDismissStorageKey() {
  return `${APP_STORAGE_NS}_ann_dismiss`;
}

export function announcementGlobalKey(updatedAt) {
  return `${APP_STORAGE_NS}_ann_global_${updatedAt}`;
}
