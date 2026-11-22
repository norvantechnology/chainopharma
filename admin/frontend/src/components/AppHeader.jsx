import ProfileDropdown, { IconLogout } from "./ProfileDropdown.jsx";
import { useNavigate } from "react-router-dom";
import { clearAuth, readAuth } from "../services/authStorage.js";
import { APP_DISPLAY_NAME, APP_DOCUMENT_TITLE } from "../constants/brand.js";
import Breadcrumbs from "./Breadcrumbs.jsx";
import { Bell, Menu, MessageSquare, Search, Settings } from "./ui/AppIcons.jsx";
import "./AppHeader.css";

export default function AppHeader({ title = APP_DOCUMENT_TITLE, userName = "Admin", onMenuClick }) {
  const navigate = useNavigate();

  return (
    <header className="hdr">
      <button className="hdrToggle" type="button" title="Toggle sidebar" aria-label="Open menu" onClick={onMenuClick}>
        <Menu aria-hidden="true" size={18} strokeWidth={2.2} />
      </button>

      <Breadcrumbs
        rootLabel={APP_DISPLAY_NAME}
        rootTo="/dashboard"
        labels={{
          "/dashboard": "Dashboard",
          "/users": "Users",
          "/notice-bar": "Notice bar"
        }}
      />

      <div className="hdrSearch" role="search">
        <Search aria-hidden="true" size={16} strokeWidth={2.2} />
        <input type="text" placeholder="Search…" disabled />
        <span className="hdrShortcut">⌘K</span>
      </div>

      <div className="hdrRight">
        <button className="hdrIconBtn" type="button" title="Notifications" aria-label="Notifications">
          <Bell aria-hidden="true" size={18} strokeWidth={2.0} />
          <span className="hdrBadge" aria-hidden="true" />
        </button>
        <button className="hdrIconBtn" type="button" title="Messages" aria-label="Messages">
          <MessageSquare aria-hidden="true" size={18} strokeWidth={2.0} />
        </button>
        <button className="hdrIconBtn" type="button" title="Settings" aria-label="Settings">
          <Settings aria-hidden="true" size={18} strokeWidth={2.0} />
        </button>

        <div className="hdrDivider" role="separator" aria-orientation="vertical" />

        <ProfileDropdown
          userName={userName || "Admin"}
          userRole={"Administrator"}
          userEmail={readAuth()?.user?.email || readAuth()?.email || ""}
          roleChipText={"ADMIN"}
          footerVersionText={"v1 · Admin Panel"}
          menuItems={[
            {
              key: "logout",
              icon: <IconLogout />,
              label: "Log out",
              danger: true,
              onClick: () => {
                const auth = readAuth();
                if (auth) clearAuth();
                navigate("/login", { replace: true });
              }
            }
          ]}
        />
      </div>
    </header>
  );
}

