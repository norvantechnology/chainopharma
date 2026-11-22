import React from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  Eye,
  LayoutGrid,
  Lock,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  PlusCircle,
  Search,
  Settings,
  Shield,
  Users,
  ChevronLeft
} from "lucide-react";

/**
 * Single, shared icon registry for the admin frontend.
 * Uses ONE icon dependency: `lucide-react`.
 */

export { Activity, Bell, LayoutGrid, Megaphone, Menu, MessageSquare, Search, Settings, Users, ChevronLeft };

/**
 * IconAlert  warning/confirm dialog icon.
 * Used in: `components/ConfirmDialog.jsx`.
 */
export function IconAlert(p) {
  return <AlertTriangle aria-hidden="true" size={18} strokeWidth={2.4} {...p} />;
}

/**
 * IconCrumbChevron  breadcrumb separator chevron.
 * Used in: `components/Breadcrumbs.jsx`.
 */
export function IconCrumbChevron(p) {
  return <ChevronRight aria-hidden="true" size={12} strokeWidth={2.5} {...p} />;
}

/**
 * IconAuthMail  email input leading icon.
 * Used in: `pages/AdminLoginPage.jsx`.
 */
export function IconAuthMail(p) {
  return <Mail aria-hidden="true" size={16} strokeWidth={2.2} className="ico" {...p} />;
}

/**
 * IconAuthLock  password input leading icon.
 * Used in: `pages/AdminLoginPage.jsx`.
 */
export function IconAuthLock(p) {
  return <Lock aria-hidden="true" size={16} strokeWidth={2.2} className="ico" {...p} />;
}

/**
 * IconAuthEye  password visibility toggle icon.
 * Used in: `pages/AdminLoginPage.jsx` eye toggle button.
 */
export function IconAuthEye(p) {
  return <Eye aria-hidden="true" size={18} strokeWidth={2.2} {...p} />;
}

/**
 * IconBrandMark  Chaino Pharma brand mark used in auth header.
 * Used in: `pages/AdminLoginPage.jsx` logo icon.
 */
export function IconBrandMark(p) {
  return <PlusCircle aria-hidden="true" size={22} strokeWidth={2.2} {...p} />;
}

/**
 * IconSecure  security/shield icon used in auth footer.
 * Used in: `pages/AdminLoginPage.jsx` (“Admin access is protected”).
 */
export function IconSecure(p) {
  return <Shield aria-hidden="true" size={18} strokeWidth={2.2} {...p} />;
}

export function IconPulse() {
  return <Activity aria-hidden="true" size={18} strokeWidth={2.2} />;
}

export function IconCollapseChevron() {
  return <ChevronLeft aria-hidden="true" size={14} strokeWidth={2.6} />;
}

export function IconDots() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

