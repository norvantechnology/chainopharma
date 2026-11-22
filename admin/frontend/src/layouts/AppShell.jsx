import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { sidebarCollapsedStorageKey } from "../constants/brand.js";
import "./AppShell.css";

function readBool(key, fallback) {
  try {
    const v = window.localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // ignore
  }
  return fallback;
}

function writeBool(key, val) {
  try {
    window.localStorage.setItem(key, val ? "1" : "0");
  } catch {
    // ignore
  }
}

export default function AppShell({ title, userName, userEmail, userBusinessName, userGstNumber, children, variant = "admin" }) {
  const collapseKey = useMemo(() => sidebarCollapsedStorageKey(variant), [variant]);
  const [collapsed, setCollapsed] = useState(() => readBool(collapseKey, false));
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => writeBool(collapseKey, collapsed), [collapseKey, collapsed]);

  return (
    <div className={`appShell2 ${collapsed ? "appShell2_collapsed" : ""}`}>
      <Sidebar
        variant={variant}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onOpenMobile={() => setMobileOpen(true)}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={() => setMobileOpen(false)}
        userName={userName || "Admin User"}
        userEmail={userEmail || ""}
        businessName={userBusinessName || ""}
        gstNumber={userGstNumber || ""}
      />

      <div className="appShell2Main">
        <AppHeader
          title={title}
          userName={userName}
          onMenuClick={() => setMobileOpen(true)}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          collapsed={collapsed}
        />
        <div className="appShell2Content" data-app-main="true">
          {children}
        </div>
      </div>
    </div>
  );
}

