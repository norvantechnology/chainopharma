import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ReportShell, ReportDenied, ReportPageIntro } from "../components/reports/index.js";
import { can } from "../utils/access.js";
import { onAuthChanged } from "../services/authStorage.js";
import { NAV_LABELS } from "../constants/navLabels.js";
import { ProductSupplierReportContent } from "./ProductSupplierReportPage.jsx";
import { MfgStockistReportContent } from "./MfgStockistReportPage.jsx";
import { NonMovingReportContent } from "./NonMovingReportPage.jsx";
import "./MergedReportsPage.css";

const ALL_TABS = [
  {
    id: "stock-list",
    aliases: ["stock-list", "product-supplier", "stock"],
    label: NAV_LABELS.reportProductSupplier || "Stock List",
    hint: "Search products, suppliers, rates, and batch-wise stock.",
    perm: () => can("PRODUCT_BATCHES", "VIEW")
  },
  {
    id: "mfg-stockist",
    aliases: ["mfg-stockist", "stockist"],
    label: NAV_LABELS.reportMfgStockist || "Mfg Stockist",
    hint: "See which suppliers stock each manufacturer.",
    perm: () => can("MFG_COMPANIES", "VIEW") || can("PRODUCT_BATCHES", "VIEW")
  },
  {
    id: "non-moving",
    aliases: ["non-moving", "nonmoving", "dead-stock"],
    label: NAV_LABELS.reportNonMoving || "Non Moving",
    hint: "Batches with stock but no recent sales.",
    perm: () => can("PRODUCT_BATCHES", "VIEW")
  }
];

function resolveTabId(raw, tabs) {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return tabs[0]?.id || "stock-list";
  const hit = tabs.find((t) => t.id === key || (t.aliases || []).includes(key));
  return hit?.id || tabs[0]?.id || "stock-list";
}

export default function InventoryReportsPage() {
  const [authTick, setAuthTick] = useState(0);
  useEffect(() => onAuthChanged(() => setAuthTick((n) => n + 1)), []);

  const tabs = useMemo(() => ALL_TABS.filter((t) => t.perm()), [authTick]);
  const canAny = tabs.length > 0;
  const defaultTab = tabs[0]?.id || "stock-list";
  const [params, setParams] = useSearchParams();
  const urlTabRaw = String(params.get("tab") || "");
  const urlTab = resolveTabId(urlTabRaw, tabs);
  const [tab, setTab] = useState(urlTab);

  useEffect(() => {
    setTab(urlTab);
  }, [urlTab]);

  useEffect(() => {
    if (!canAny) return;
    const normalized = resolveTabId(urlTabRaw, tabs);
    if (!urlTabRaw || urlTabRaw !== normalized) {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("tab", normalized || defaultTab);
          return p;
        },
        { replace: true }
      );
    }
  }, [canAny, defaultTab, setParams, tabs, urlTabRaw]);

  const activeMeta = useMemo(() => tabs.find((t) => t.id === tab) || tabs[0] || null, [tab, tabs]);

  if (!canAny) {
    return <ReportDenied title="Inventory Reports" message="You don’t have permission to view these reports." />;
  }

  function setActive(nextId) {
    const next = resolveTabId(nextId, tabs);
    setTab(next);
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", next);
        return p;
      },
      { replace: true }
    );
  }

  return (
    <ReportShell>
      <div className="pageWrap invReportPage">
        <ReportPageIntro
          title="Inventory Reports"
          subtitle={`Chaino Pharma > Reports > Inventory Reports${activeMeta?.label ? ` > ${activeMeta.label}` : ""}`}
        />

        <div className="mrTabs mrTabs_scroll invReportTabs" role="tablist" aria-label="Inventory report tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`inv-panel-${t.id}`}
              id={`inv-tab-${t.id}`}
              className={`mrTab${tab === t.id ? " mrTab_active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActive(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mrBody invReportBody" role="tabpanel" id={`inv-panel-${tab}`} aria-labelledby={`inv-tab-${tab}`}>
          {tab === "stock-list" ? <ProductSupplierReportContent embedded /> : null}
          {tab === "mfg-stockist" ? <MfgStockistReportContent embedded /> : null}
          {tab === "non-moving" ? <NonMovingReportContent embedded /> : null}
        </div>
      </div>
    </ReportShell>
  );
}
