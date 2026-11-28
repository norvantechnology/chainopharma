import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearAuth, readAuth } from "../services/authStorage.js";
import { APP_DISPLAY_NAME } from "../constants/brand.js";
import { IconCollapseChevron, IconDots, IconPulse, LayoutGrid, Megaphone, Users } from "./ui/AppIcons.jsx";
import "./Sidebar.css";

function IconDashboard() {
  return <LayoutGrid aria-hidden="true" size={18} strokeWidth={2.2} />;
}

function IconUsersNav() {
  return <Users aria-hidden="true" size={18} strokeWidth={2.2} />;
}

function IconMegaphone() {
  return <Megaphone aria-hidden="true" size={18} strokeWidth={2.2} />;
}

function initialsFrom(nameOrEmail) {
  const s = String(nameOrEmail || "AD").trim();
  if (!s) return "AD";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || "A"}${parts[1][0] || "D"}`.toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function Sidebar({
  variant = "admin",
  collapsed = false,
  mobileOpen = false,
  onToggleCollapse,
  onOpenMobile,
  onCloseMobile,
  onNavigate,
  userName,
  userEmail,
  businessName,
  gstNumber
}) {
  const sections = useMemo(() => {
    // Keep structure identical to HTML design; menu items are panel-specific.
    return [
      {
        title: "Main",
        items: [{ to: "/dashboard", label: "Dashboard", icon: <IconDashboard /> }]
      },
      {
        title: "Management",
        items: [
          { to: "/users", label: "Users", icon: <IconUsersNav /> },
          { to: "/notice-bar", label: "Notice bar", icon: <IconMegaphone /> }
        ]
      }
    ];
  }, []);

  const flatNavItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const indexForPath = useCallback(
    (pathname) => {
      const path = String(pathname || "");
      let best = 0;
      let bestLen = -1;
      flatNavItems.forEach((it, i) => {
        const to = String(it.to || "");
        if (!to) return;
        if (path === to || (to !== "/" && path.startsWith(`${to}/`))) {
          if (to.length > bestLen) {
            bestLen = to.length;
            best = i;
          }
        }
      });
      return best;
    },
    [flatNavItems]
  );

  const panelLabel = variant === "admin" ? "Admin Panel" : "User Panel";
  const avatar = initialsFrom(userName || userEmail || "Admin");
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [kbdRingIndex, setKbdRingIndex] = useState(null);
  const kbdRingRef = useRef(null);
  kbdRingRef.current = kbdRingIndex;
  const menuRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuOpen) return;
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    setKbdRingIndex(null);
  }, [location.pathname]);

  function isBlockingOverlay() {
    if (menuOpen) return true;
    if (document.querySelector(".cmRoot")) return true;
    if (document.querySelector('.udpRoot[aria-hidden="false"]')) return true;
    if (document.querySelector('[role="dialog"][aria-hidden="false"]')) return true;
    if (document.querySelector('[role="listbox"]')) return true;
    return false;
  }

  function isEditable(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  useEffect(() => {
    function onKeyDown(e) {
      const key = e.key;
      if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Escape") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      if (isBlockingOverlay()) {
        if (kbdRingRef.current !== null) setKbdRingIndex(null);
        return;
      }

      const active = document.activeElement;
      const navEl = navRef.current;

      if (active?.matches?.("a.nav-item") && navEl) {
        if (key === "ArrowDown" || key === "ArrowUp") {
          const links = [...navEl.querySelectorAll("a.nav-item")];
          const i = links.indexOf(active);
          if (i >= 0) {
            e.preventDefault();
            e.stopPropagation();
            const next = key === "ArrowDown" ? Math.min(links.length - 1, i + 1) : Math.max(0, i - 1);
            links[next]?.focus?.();
          }
          return;
        }
      }

      if (key === "Escape") {
        if (kbdRingRef.current !== null) {
          e.preventDefault();
          setKbdRingIndex(null);
        }
        return;
      }

      if (isEditable(active)) return;
      if (active?.closest?.(".ct tbody tr")) return;

      const n = flatNavItems.length;
      if (!n) return;

      e.preventDefault();
      e.stopPropagation();
      setKbdRingIndex((prev) => {
        const start = prev !== null ? prev : indexForPath(location.pathname);
        let next = key === "ArrowDown" ? start + 1 : start - 1;
        next = ((next % n) + n) % n;
        requestAnimationFrame(() => {
          navEl?.querySelector(`a.nav-item[data-sb-idx="${next}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
        return next;
      });
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [flatNavItems.length, indexForPath, location.pathname, menuOpen]);

  useEffect(() => {
    function onKeyCapture(e) {
      if (e.key !== "Enter" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (kbdRingIndex === null) return;
      if (isBlockingOverlay()) return;
      if (isEditable(document.activeElement)) return;

      const item = flatNavItems[kbdRingIndex];
      if (!item?.to) return;

      e.preventDefault();
      e.stopPropagation();
      setKbdRingIndex(null);
      navigate(item.to);
      onNavigate?.();
    }
    document.addEventListener("keydown", onKeyCapture, true);
    return () => document.removeEventListener("keydown", onKeyCapture, true);
  }, [flatNavItems, kbdRingIndex, menuOpen, navigate, onNavigate]);

  return (
    <>
      <div
        className={`overlay ${mobileOpen ? "visible" : ""}`}
        onClick={mobileOpen ? onCloseMobile : undefined}
        aria-hidden={!mobileOpen}
        tabIndex={-1}
      />

      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
        aria-label={`${panelLabel} sidebar`}
      >
        <button className="sidebar-toggle" type="button" onClick={onToggleCollapse} title="Toggle sidebar" aria-label="Toggle sidebar">
          <IconCollapseChevron />
        </button>

        <div className="sidebar-logo">
          <div className="logo-icon" aria-hidden="true">
            <IconPulse />
          </div>
          <div className="logo-text">
            <span className="logo-name">{APP_DISPLAY_NAME}</span>
            <span className="logo-sub">{panelLabel}</span>
          </div>
        </div>

        <nav ref={navRef} className="sidebar-nav" aria-label="Primary navigation">
          {(() => {
            let sbRunning = 0;
            return sections.map((sec) => (
            <div key={sec.title}>
              <div className="nav-section-title">{sec.title}</div>
              {sec.items.map((it) => {
                const sbIdx = sbRunning++;
                const ring = kbdRingIndex === sbIdx;
                return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  data-label={it.label}
                  data-sb-idx={sbIdx}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}${ring ? " nav-item_kbd" : ""}`}
                  onClick={() => {
                    onNavigate?.();
                    setKbdRingIndex(null);
                  }}
                >
                  <div className="nav-icon" aria-hidden="true">
                    {it.icon}
                  </div>
                  <span className="nav-label">{it.label}</span>
                </NavLink>
                );
              })}
            </div>
            ));
          })()}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card" title={userEmail || userName || "Admin"} ref={menuRef}>
            <div className="user-avatar" aria-hidden="true">
              {avatar}
            </div>
            <div className="user-info">
              <div className="user-name">{userName || "Admin User"}</div>
              <div className="user-email">{userEmail || "admin@chainopharma.com"}</div>
              {businessName ? <div className="user-meta">Business: {businessName}</div> : null}
              {gstNumber ? <div className="user-meta">GST: {gstNumber}</div> : null}
            </div>

            <button
              className="user-more userMoreBtn"
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <IconDots />
            </button>

            {menuOpen ? (
              <div className="userMenu" role="menu" aria-label="Sidebar account menu">
                <button
                  className="userMenuItem"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    const auth = readAuth();
                    if (auth) clearAuth();
                    navigate("/login", { replace: true });
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sidebar-version">v1 · {panelLabel}</div>
      </aside>
    </>
  );
}

