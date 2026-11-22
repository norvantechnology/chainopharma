import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import CommonLoading from "./CommonLoading.jsx";
import { isCmPanelTopStackLayer, scrollModalFieldIntoView } from "../utils/modalFocusNav.js";
import "./CommonModal.css";

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled]), [contenteditable=""]:not([aria-disabled="true"]), [contenteditable="true"]:not([aria-disabled="true"])';

function isVisible(el) {
  if (!el) return false;
  if (el.hidden) return false;
  const rect = el.getBoundingClientRect?.();
  if (!rect) return true;
  return rect.width > 0 && rect.height > 0;
}

function getFocusables(panel) {
  if (!panel) return [];
  return [...panel.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => isVisible(el) && el.tabIndex !== -1);
}

function getFieldSignature(el, fields) {
  if (!el) return null;
  const tag = String(el.tagName || "").toLowerCase();
  return JSON.stringify({
    tag,
    type: el.type || "",
    placeholder: el.getAttribute?.("placeholder") || "",
    aria: el.getAttribute?.("aria-label") || "",
    name: el.getAttribute?.("name") || "",
    id: el.id || "",
    idx: fields.indexOf(el)
  });
}

function findFieldBySignature(sig, fields, panel) {
  if (!sig || !fields.length) return null;
  let parsed;
  try {
    parsed = JSON.parse(sig);
  } catch {
    return null;
  }
  const exact = fields.find((f) => getFieldSignature(f, fields) === sig);
  if (exact) return exact;
  if (parsed.name && panel) {
    const byName = panel.querySelector(`[name="${window.CSS?.escape?.(parsed.name) || parsed.name}"]`);
    if (byName && fields.includes(byName)) return byName;
  }
  if (parsed.id && panel) {
    const byId = panel.querySelector(`#${window.CSS?.escape?.(parsed.id) || parsed.id}`);
    if (byId && fields.includes(byId)) return byId;
  }
  if (parsed.placeholder) {
    const byPh = fields.find(
      (f) => (f.getAttribute?.("placeholder") || "") === parsed.placeholder && String(f.tagName || "").toLowerCase() === parsed.tag
    );
    if (byPh) return byPh;
  }
  if (typeof parsed.idx === "number" && parsed.idx >= 0 && parsed.idx < fields.length) return fields[parsed.idx];
  return null;
}

function setReactInputValue(el, value) {
  const tag = String(el.tagName || "").toLowerCase();
  const proto = tag === "textarea" ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
  const setter = proto && Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const cmFocusMemory = (() => {
  if (typeof window === "undefined") return new Map();
  if (!window.__cmFocusMemory) window.__cmFocusMemory = new Map();
  return window.__cmFocusMemory;
})();

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * CommonModal
 * - Fully reusable: title/subtitle/body/footer
 * - Size: "sm" | "md" | "lg" | number(px)
 * - Close: overlay click + Escape
 * - Hotkeys: Enter (primary), Esc (cancel/close)
 * - Extra: loading, portal, headerTools
 */
export default function CommonModal({
  open,
  title,
  subtitle,
  children,
  headerTools = null,
  footer,
  onClose,
  size = "md",
  closeOnOverlay = true,
  ariaLabel,
  icon,
  loading = false,
  loadingText = "Loading...",
  hideFooterWhenLoading = true,
  portal = false,
  portalZIndex = 480
}) {
  const panelRef = useRef(null);
  const memoryKey = String(ariaLabel || title || "");

  const w = useMemo(() => {
    if (typeof size === "number") return `${size}px`;
    if (size === "sm") return "420px";
    if (size === "lg") return "860px";
    return "560px";
  }, [size]);

  useEffect(() => {
    if (!open || !portal || typeof document === "undefined") return;
    const el = document.documentElement;
    const prev = el.style.getPropertyValue("--cm-z");
    el.style.setProperty("--cm-z", String(portalZIndex));
    return () => {
      if (prev) el.style.setProperty("--cm-z", prev);
      else el.style.removeProperty("--cm-z");
    };
  }, [open, portal, portalZIndex]);

  useEffect(() => {
    if (!open) return;

    function normText(v) { return String(v || "").trim().toLowerCase(); }
    function isCancelLike(btn) {
      if (!btn) return false;
      const cls = String(btn.className || "").toLowerCase();
      const txt = normText(btn.textContent);
      return cls.includes("ghost") || txt === "cancel" || txt === "close" || txt.includes("cancel");
    }
    function isPrimaryLike(btn) {
      if (!btn) return false;
      const cls = String(btn.className || "").toLowerCase();
      const txt = normText(btn.textContent);
      return cls.includes("primary") || txt.includes("save") || txt.includes("create") || txt.includes("confirm") || txt.includes("submit") || txt.includes("record") || txt.includes("update");
    }
    function findPrimaryButton(panel) {
      if (!panel) return null;
      const explicit = panel.querySelector?.('[data-cm-primary="true"]');
      if (explicit && !explicit.disabled) return explicit;
      const footerButtons = [...(panel.querySelectorAll?.(".cmFooter button") || [])].filter((b) => !b.disabled);
      if (!footerButtons.length) return null;
      const byPrimaryHint = footerButtons.find((b) => isPrimaryLike(b) && !isCancelLike(b));
      if (byPrimaryHint) return byPrimaryHint;
      const nonCancel = footerButtons.filter((b) => !isCancelLike(b));
      if (nonCancel.length) return nonCancel[nonCancel.length - 1];
      return null;
    }
    function findCancelButton(panel) {
      if (!panel) return null;
      const explicit = panel.querySelector?.('[data-cm-cancel="true"]');
      if (explicit && !explicit.disabled) return explicit;
      const footerButtons = [...(panel.querySelectorAll?.(".cmFooter button") || [])].filter((b) => !b.disabled);
      return footerButtons.find((b) => isCancelLike(b)) || null;
    }

    function onKey(e) {
      const panel = panelRef.current;
      const active = document.activeElement;
      const inModal = panel && active ? panel.contains(active) : false;
      if (loading) return;

      function isEditableEl(el) {
        if (!el) return false;
        const tag = String(el.tagName || "").toLowerCase();
        if (tag === "textarea" || tag === "select") return true;
        if (el.isContentEditable) return true;
        return false;
      }

      if (e.key === "Escape") {
        if (!isCmPanelTopStackLayer(panel)) return;
        e.preventDefault();
        e.stopPropagation();
        const cancelBtn = findCancelButton(panel);
        if (cancelBtn) { cancelBtn.click(); return; }
        onClose?.();
        return;
      }

      if (panel && isCmPanelTopStackLayer(panel) && !e.altKey && !e.ctrlKey && !e.metaKey && e.key !== "Tab") {
        const fields = getFocusables(panel);
        const focusedField = inModal && fields.includes(active);
        const shouldHijack = !focusedField && fields.length > 0 && (
          e.key === "Enter" || e.key === "Backspace" || e.key === " " || e.key === "Spacebar" ||
          e.key.startsWith("Arrow") || (typeof e.key === "string" && e.key.length === 1)
        );
        if (shouldHijack) {
          const sig = cmFocusMemory.get(memoryKey);
          const target = (sig ? findFieldBySignature(sig, fields, panel) : null) || fields[0];
          if (target) {
            e.preventDefault();
            e.stopPropagation();
            try { target.focus({ preventScroll: false }); } catch { target.focus?.(); }
            scrollModalFieldIntoView(target);
            const tag = String(target.tagName || "").toLowerCase();
            if ((tag === "input" || tag === "textarea") && typeof e.key === "string" && e.key.length === 1) {
              setReactInputValue(target, `${target.value || ""}${e.key}`);
              try { const end = target.value.length; target.setSelectionRange?.(end, end); } catch { /* ignore */ }
            } else if ((tag === "input" || tag === "textarea") && e.key === "Backspace") {
              const cur = target.value || "";
              if (cur.length) setReactInputValue(target, cur.slice(0, -1));
            } else if (tag === "input" && typeof target.select === "function") {
              try { target.select(); } catch { /* ignore */ }
            }
            return;
          }
        }
      }

      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.altKey) {
        if (!inModal) return;
        e.preventDefault();
        const primaryBtn = findPrimaryButton(panel);
        if (primaryBtn) primaryBtn.click();
        return;
      }

      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!inModal) return;
        if (isEditableEl(active)) return;
        e.preventDefault();
        const primaryBtn = findPrimaryButton(panel);
        if (primaryBtn) primaryBtn.click();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, loading, memoryKey]);

  useEffect(() => {
    if (!open || loading) return;
    let cancelled = false;
    let tries = 0;
    function attempt() {
      if (cancelled) return;
      const panel = panelRef.current;
      if (!panel) { if (tries++ < 40) requestAnimationFrame(attempt); return; }
      const fields = getFocusables(panel);
      const target = fields[0] || panel.querySelector(".cmFooter button[data-cm-cancel='true']") || panel.querySelector(".cmFooter button:not([disabled])");
      if (!target) { if (tries++ < 40) requestAnimationFrame(attempt); return; }
      const active = document.activeElement;
      if (active && panel.contains(active)) {
        if (fields.includes(active)) return;
        if (!fields.length && active.closest?.(".cmFooter")) return;
      }
      try { target.focus({ preventScroll: false }); } catch { target.focus?.(); }
      scrollModalFieldIntoView(target);
      const tag = String(target.tagName || "").toLowerCase();
      if (tag === "input" && typeof target.select === "function") {
        try { target.select(); } catch { /* ignore */ }
      }
    }
    requestAnimationFrame(attempt);
    return () => { cancelled = true; };
  }, [open, loading, memoryKey]);

  useEffect(() => {
    if (!open || loading) return;
    const panel = panelRef.current;
    if (!panel) return;
    function onFocusIn(e) {
      const t = e.target;
      if (!t || !panel.contains(t)) return;
      const tag = String(t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) {
        scrollModalFieldIntoView(t);
      }
    }
    panel.addEventListener("focusin", onFocusIn, true);
    return () => panel.removeEventListener("focusin", onFocusIn, true);
  }, [open, loading]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    function record(e) {
      const t = e.target;
      if (!t || !panel.contains(t)) return;
      const fields = getFocusables(panel);
      if (!fields.includes(t)) return;
      const sig = getFieldSignature(t, fields);
      if (sig) cmFocusMemory.set(memoryKey, sig);
    }
    panel.addEventListener("input", record, true);
    panel.addEventListener("change", record, true);
    panel.addEventListener("focusin", record, true);
    return () => {
      panel.removeEventListener("input", record, true);
      panel.removeEventListener("change", record, true);
      panel.removeEventListener("focusin", record, true);
    };
  }, [open, memoryKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const tree = (
    <div className="cmRoot" role="dialog" aria-modal="true" aria-label={ariaLabel || title || "Modal"}>
      <button
        className="cmOverlay"
        type="button"
        aria-label="Close modal"
        onClick={() => (closeOnOverlay ? onClose?.() : null)}
      />

      <div className="cmPanel" ref={panelRef} style={{ width: w }}>
        <div className="cmHeader">
          <div className="cmHeadText">
            {title ? <div className="cmTitle">{title}</div> : null}
            {subtitle ? <div className="cmSub">{subtitle}</div> : null}
          </div>
          {headerTools ? <div className="cmHeadTools">{headerTools}</div> : null}
          <button className="cmClose" type="button" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        <div className="cmBody">
          {loading ? (
            <div className="cmLoading">
              <CommonLoading variant="page" text={loadingText || "Loading"} />
            </div>
          ) : (
            children
          )}
        </div>

        {footer && (!hideFooterWhenLoading || !loading) ? (
          <div className="cmFooter">{footer}</div>
        ) : null}
      </div>
    </div>
  );

  if (portal && typeof document !== "undefined") {
    return createPortal(tree, document.body);
  }
  return tree;
}
