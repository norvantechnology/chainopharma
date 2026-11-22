import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeToasts } from "../services/toastBus.js";
import "./ToastProvider.css";

function toastTypeFrom(input) {
  const t = String(input || "info").toLowerCase();
  if (t === "success" || t === "error" || t === "info" || t === "warning") return t;
  return "info";
}

function IconByType({ type }) {
  if (type === "success") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (type === "warning") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const prevIdsRef = useRef(new Set());

  const removeToast = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) window.clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t)));
  }, []);

  const showToast = useCallback(
    (type, titleOrMessage, opts) => {
      const t = toastTypeFrom(type);
      const title = String(opts?.title ?? titleOrMessage ?? "").trim();
      const message = String(opts?.message ?? "").trim();
      if (!title && !message) return;

      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const autoHide = opts?.autoHide === undefined ? true : Boolean(opts.autoHide);
      const ttlMs = Number(opts?.ttlMs ?? 4000);

      const toast = {
        id,
        type: t,
        title: title || message,
        message: title ? message : "",
        autoHide,
        ttlMs,
        dismissing: false
      };

      setToasts((prev) => [toast, ...prev].slice(0, 4));

      if (autoHide) {
        const timer = window.setTimeout(() => dismissToast(id), ttlMs);
        timersRef.current.set(id, timer);
      }
    },
    [dismissToast]
  );

  useEffect(() => {
    return subscribeToasts((t) => {
      const type = t?.type || "info";
      const title = t?.title;
      const message = t?.message;
      const ttlMs = t?.ttlMs;
      const autoHide = t?.autoHide;

      const sig = `${type}::${String(title ?? "")}::${String(message ?? "")}`;
      if (prevIdsRef.current.has(sig)) return;
      prevIdsRef.current.add(sig);
      queueMicrotask(() => prevIdsRef.current.delete(sig));

      showToast(type, title || message || "", { title, message, ttlMs, autoHide });
    });
  }, [showToast]);

  return (
    <>
      {children}
      <div className="toast-container" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.type} ${t.dismissing ? "dismissing" : ""}`}
            role="status"
            style={{ "--duration": `${Math.max(0, Number(t.ttlMs || 4000)) / 1000}s` }}
            onAnimationEnd={(e) => {
              if (!t.dismissing) return;
              if (e.animationName !== "toastOut") return;
              removeToast(t.id);
            }}
          >
            <div className="toast-body">
              <div className="toast-icon" aria-hidden="true">
                <IconByType type={t.type} />
              </div>
              <div className="toast-content">
                <div className="toast-title">{t.title}</div>
                {t.message ? <div className="toast-message">{t.message}</div> : null}
              </div>
              <button className="toast-close" type="button" aria-label="Dismiss notification" title="Dismiss" onClick={() => dismissToast(t.id)}>
                <IconClose />
              </button>
            </div>
            {t.autoHide ? (
              <div className="toast-progress" aria-hidden="true">
                <div className="toast-progress-bar" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

