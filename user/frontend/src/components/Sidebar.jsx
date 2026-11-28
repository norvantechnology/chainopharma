import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clearAuth, onAuthChanged, readAuth } from "../services/authStorage.js";
import { logout } from "../services/authService.js";
import { APP_DISPLAY_NAME, sidebarNavScrollStorageKey } from "../constants/brand.js";
import { NAV_LABELS } from "../constants/navLabels.js";
import { isRetailerAuth } from "../utils/businessRole.js";
import {
  BadgeIndianRupee,
  Building2,
  CreditCard,
  FileSpreadsheet,
  IconCollapseChevron,
  IconDots,
  IconPulse,
  IconLedger,
  IconCatalog,
  IconOrder,
  IconDayBook,
  IconNonMoving,
  ClipboardList,
  LayoutGrid,
  Package2,
  RotateCcw,
  IconReturn,
  ShieldCheck,
  Truck,
  Users,
  UsersRound,
  WalletCards,
  Layers
} from "./ui/AppIcons.jsx";
import "./Sidebar.css";

// Persist sidebar nav scroll position across route changes.
const SIDEBAR_SCROLL_STORAGE_KEY = sidebarNavScrollStorageKey();
let sidebarNavScrollCache = (() => {
  try {
    const v = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
})();

function initialsFrom(nameOrEmail) {
  const s = String(nameOrEmail || "US").trim();
  if (!s) return "US";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || "U"}${parts[1][0] || "S"}`.toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function Sidebar({
  variant = "user",
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
  const [authTick, setAuthTick] = useState(0);
  const auth = readAuth();
  const access = auth?.access || null;
  const isRetailer = isRetailerAuth(auth);
  const perms = access?.permissions || {};
  // Use filtered permissions from /access/me (owners included). Do not
  // blanket-allow via isAccountOwner — that breaks retailer/wholesaler RBAC.
  const canUsers = Boolean(perms?.USERS?.VIEW);
  const canRoles = Boolean(perms?.ROLES?.VIEW);
  const canDivisions = Boolean(perms?.DIVISIONS?.VIEW) || Boolean(perms?.VENDORS?.VIEW);
  const canQuality = Boolean(perms?.PRODUCT_BATCHES?.VIEW);
  const canMfg = Boolean(perms?.MFG_COMPANIES?.VIEW);
  const canPurchase = Boolean(perms?.PURCHASE_INVOICES?.VIEW);
  const canPurchaseReturns = Boolean(perms?.PURCHASE_RETURNS?.VIEW);
  const canCustomers = Boolean(perms?.CUSTOMERS?.VIEW);
  const canSales = Boolean(perms?.SALES_INVOICES?.VIEW);
  const canSalesReturns = Boolean(perms?.SALES_RETURNS?.VIEW);
  const canDivisionPayments = Boolean(perms?.DIVISION_PAYMENTS?.VIEW) || Boolean(perms?.VENDOR_PAYMENTS?.VIEW);
  const canCustomerPayments = Boolean(perms?.CUSTOMER_PAYMENTS?.VIEW);
  const canPrescriptions = Boolean(perms?.PRESCRIPTIONS?.VIEW);
  const canOrders = Boolean(perms?.ORDERS?.VIEW) || Boolean(perms?.PURCHASE_ORDERS?.VIEW);
  const canWholesalerLinks = Boolean(perms?.WHOLESALER_LINKS?.VIEW);

  useEffect(() => {
    return onAuthChanged(() => setAuthTick((t) => t + 1));
  }, []);

  const sections = useMemo(() => {
    const out = [
      {
        title: "Main",
        items: [{ to: "/dashboard", label: NAV_LABELS.dashboard, icon: <LayoutGrid aria-hidden="true" size={18} strokeWidth={2.2} /> }]
      }
    ];

    const divisionBaseTo = isRetailer ? "/vendors" : "/divisions";
    const masterSetupItems = [
      ...(canQuality ? [{ to: "/quality-master", label: NAV_LABELS.qualityMaster, icon: <Package2 aria-hidden="true" size={18} strokeWidth={2.2} /> }] : []),
      ...(canMfg ? [{ to: "/mfg-companies", label: NAV_LABELS.mfgCompanies, icon: <Building2 aria-hidden="true" size={18} strokeWidth={2.2} /> }] : []),
      ...(canDivisions
        ? [{ to: divisionBaseTo, label: isRetailer ? "Suppliers" : NAV_LABELS.divisions, icon: <Truck aria-hidden="true" size={18} strokeWidth={2.2} /> }]
        : []),
      ...(canCustomers ? [{ to: "/customers", label: NAV_LABELS.customers, icon: <UsersRound aria-hidden="true" size={18} strokeWidth={2.2} /> }] : [])
    ];
    if (masterSetupItems.length) out.push({ title: "Master Setup", items: masterSetupItems });

    const txnItems = [
      ...(canPurchase ? [{ to: "/purchase-invoices", label: NAV_LABELS.purchaseInvoices, icon: <ClipboardList aria-hidden="true" size={18} strokeWidth={2.2} /> }] : []),
      ...(canPurchaseReturns
        ? [{ to: "/purchase-returns", label: NAV_LABELS.purchaseReturns, icon: <IconReturn aria-hidden="true" size={18} strokeWidth={2.2} /> }]
        : []),
      ...(canSales
        ? [{ to: "/sales-billing", label: isRetailer ? "Sales & Billing" : NAV_LABELS.salesBilling, icon: <WalletCards aria-hidden="true" size={18} strokeWidth={2.2} /> }]
        : []),
      ...(canSalesReturns ? [{ to: "/sales-returns", label: NAV_LABELS.salesReturns, icon: <RotateCcw aria-hidden="true" size={18} strokeWidth={2.2} /> }] : []),
      ...(canDivisionPayments
        ? [
            {
              to: isRetailer ? "/vendor-payments" : "/division-payments",
              label: isRetailer ? NAV_LABELS.supplierPayments : NAV_LABELS.divisionPayments,
              icon: <CreditCard aria-hidden="true" size={18} strokeWidth={2.2} />
            }
          ]
        : []),
      ...(canCustomerPayments
        ? [{ to: "/customer-payments", label: NAV_LABELS.customerPayments, icon: <BadgeIndianRupee aria-hidden="true" size={18} strokeWidth={2.2} /> }]
        : [])
    ];
    if (txnItems.length) out.push({ title: "Transactions", items: txnItems });

    const marketplaceItems = [];
    if (isRetailer) {
      if (canWholesalerLinks) {
        marketplaceItems.push({
          to: "/wholesaler-links",
          label: NAV_LABELS.wholesalerLinks,
          icon: <Layers aria-hidden="true" size={18} strokeWidth={2.2} />
        });
      }
      if (canOrders || canWholesalerLinks) {
        marketplaceItems.push({
          to: "/order-products",
          label: NAV_LABELS.orderProducts,
          icon: <IconCatalog aria-hidden="true" size={18} strokeWidth={2.2} />
        });
      }
      if (canOrders) {
        marketplaceItems.push({
          to: "/my-orders",
          label: NAV_LABELS.myOrders,
          icon: <IconOrder aria-hidden="true" size={18} strokeWidth={2.2} />
        });
      }
    } else {
      if (canWholesalerLinks) {
        marketplaceItems.push({
          to: "/wholesaler-links",
          label: NAV_LABELS.matchRequests,
          icon: <Layers aria-hidden="true" size={18} strokeWidth={2.2} />
        });
      }
      if (canOrders) {
        marketplaceItems.push({
          to: "/orders",
          label: NAV_LABELS.orders,
          icon: <IconOrder aria-hidden="true" size={18} strokeWidth={2.2} />
        });
      }
    }
    if (marketplaceItems.length) out.push({ title: "Marketplace", items: marketplaceItems });

    if (canPrescriptions && isRetailer) {
      out.push({
        title: "Pharmacy",
        items: [
          {
            to: "/prescriptions",
            label: NAV_LABELS.prescriptions || "Prescriptions",
            icon: <FileSpreadsheet aria-hidden="true" size={18} strokeWidth={2.2} />
          }
        ]
      });
    }

    const canGst = canSales || canPurchase;
    const reportItems = [
      ...(canQuality || canMfg
        ? [{ to: "/reports/inventory", label: NAV_LABELS.reportInventory, icon: <IconNonMoving aria-hidden="true" size={18} strokeWidth={2.2} /> }]
        : []),
      ...(canSales
        ? [{ to: "/reports/day-book", label: NAV_LABELS.reportDayBook, icon: <IconDayBook aria-hidden="true" size={18} strokeWidth={2.2} /> }]
        : []),
      ...(canCustomers || canDivisions
        ? [{ to: "/reports/ledger", label: NAV_LABELS.reportLedger, icon: <IconLedger aria-hidden="true" size={18} strokeWidth={2.2} /> }]
        : []),
      ...(canGst
        ? [{ to: "/gst-returns", label: NAV_LABELS.reportGst, icon: <FileSpreadsheet aria-hidden="true" size={18} strokeWidth={2.2} /> }]
        : [])
    ];
    if (reportItems.length) out.push({ title: "Reports", items: reportItems });

    const userManagementItems = [
      ...(canUsers ? [{ to: "/users", label: NAV_LABELS.users, icon: <Users aria-hidden="true" size={18} strokeWidth={2.2} /> }] : []),
      ...(canRoles ? [{ to: "/roles-access", label: NAV_LABELS.rolesAccess, icon: <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.2} /> }] : [])
    ];
    if (userManagementItems.length) out.push({ title: "Management", items: userManagementItems });

    return out;
  }, [
    canUsers,
    canRoles,
    canDivisions,
    canQuality,
    canMfg,
    canPurchase,
    canPurchaseReturns,
    canCustomers,
    canSales,
    canSalesReturns,
    canOrders,
    canWholesalerLinks,
    canPrescriptions,
    canDivisionPayments,
    canCustomerPayments,
    isRetailer,
    authTick
  ]);

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
  const avatar = initialsFrom(userName || userEmail || "User");
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [kbdRingIndex, setKbdRingIndex] = useState(null);
  const kbdRingRef = useRef(null);
  kbdRingRef.current = kbdRingIndex;
  const menuRef = useRef(null);
  const navRef = useRef(null);

  // Restore previous sidebar scroll before browser paints.
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    if (sidebarNavScrollCache > 0) {
      el.scrollTop = sidebarNavScrollCache;
    }
  }, []);

  // Persist scroll position while the user scrolls inside the sidebar.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const top = el.scrollTop;
        sidebarNavScrollCache = top;
        try {
          window.sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(top));
        } catch {
          // ignore storage errors
        }
        ticking = false;
      });
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

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

                  const snapshotScroll = () => {
                    const el = navRef.current;
                    if (!el) return;
                    const top = el.scrollTop;
                    sidebarNavScrollCache = top;
                    try {
                      window.sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(top));
                    } catch {
                      // ignore
                    }
                  };

                  return (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      title={it.label}
                      preventScrollReset
                      data-label={it.label}
                      data-sb-idx={sbIdx}
                      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}${ring ? " nav-item_kbd" : ""}`}
                      onClick={() => {
                        snapshotScroll();
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
          <div className="user-card" title={userEmail || userName || "User"} ref={menuRef}>
            <div className="user-avatar" aria-hidden="true">
              {avatar}
            </div>
            <div className="user-info">
              <div className="user-name">{userName || "User"}</div>
              <div className="user-email">
                {String(access?.customRoleName || "").trim() || (access?.isAccountOwner ? "Owner" : userEmail || "Sub user")}
              </div>
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
                    if (auth?.email && auth?.refreshToken) {
                      logout({ email: auth.email, refreshToken: auth.refreshToken }).catch(() => {});
                    }
                    clearAuth();
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
