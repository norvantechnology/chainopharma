import { useEffect, useMemo, useRef, useState } from "react";
import "./ProfileDropdown.css";

function initialsFrom(nameOrEmail, fallback = "AD") {
  const s = String(nameOrEmail || fallback).trim();
  if (!s) return fallback;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || fallback[0]}${parts[1][0] || fallback[1] || fallback[0]}`.toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconProfile() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function MenuItem({ icon, label, desc, danger, onClick }) {
  return (
    <button className={`pdItem ${danger ? "pdItem_danger" : ""}`} type="button" onClick={onClick}>
      <span className="pdItemIcon" aria-hidden="true">
        {icon}
      </span>
      <span className="pdItemText">
        <div className="pdItemLabel">{label}</div>
        {desc ? <div className="pdItemDesc">{desc}</div> : null}
      </span>
      {!danger ? (
        <span className="pdItemArrow" aria-hidden="true">
          <IconArrowRight />
        </span>
      ) : null}
    </button>
  );
}

export default function ProfileDropdown({
  userName,
  userRole,
  userEmail,
  roleChipText,
  menuItems,
  footerVersionText,
  footerActionLabel,
  onFooterAction,
  initialsFallback = "AD"
}) {
  const initials = useMemo(() => initialsFrom(userName || userEmail, initialsFallback), [userName, userEmail, initialsFallback]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="pdWrap" ref={wrapRef}>
      <button className={`pdTrigger ${open ? "pdTrigger_open" : ""}`} type="button" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <div className="pdTrigAvatar" aria-hidden="true">
          {initials}
        </div>
        <div className="pdTrigInfo">
          <span className="pdTrigName">{userName || "Admin"}</span>
          <span className="pdTrigRole">{userRole || "Administrator"}</span>
        </div>
        <span className="pdTrigChevron" aria-hidden="true">
          <IconChevronDown />
        </span>
      </button>

      <div className={`pdDropdown ${open ? "pdDropdown_open" : ""}`} role="menu" aria-label="Profile menu">
        <div className="pdIdentity">
          <div className="pdIdAvatar" aria-hidden="true">
            {initials}
          </div>
          <div className="pdIdInfo">
            <div className="pdIdName">{userName || "Admin"}</div>
            <div className="pdIdEmail">{userEmail || "-"}</div>
            {roleChipText ? <div className="pdRoleChip">{roleChipText}</div> : null}
          </div>
        </div>

        <div className="pdMenu">
          {(menuItems || []).map((it) =>
            it?.type === "divider" ? <div key={it.key} className="pdDivider" role="separator" aria-orientation="horizontal" /> : null
          )}
          {(menuItems || [])
            .filter((it) => it?.type !== "divider")
            .map((it) => (
              <MenuItem
                key={it.key}
                icon={it.icon}
                label={it.label}
                desc={it.desc}
                danger={Boolean(it.danger)}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              />
            ))}
        </div>

        {footerVersionText || (footerActionLabel && onFooterAction) ? (
          <div className="pdFooter">
            <span className="pdVersion">{footerVersionText || ""}</span>
            {footerActionLabel && onFooterAction ? (
              <button
                className="pdFooterLink"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onFooterAction();
                }}
              >
                {footerActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

