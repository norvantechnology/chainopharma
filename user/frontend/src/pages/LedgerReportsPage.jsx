import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { can } from "../utils/access.js";
import { ReportShell, ReportDenied, ReportPageIntro } from "../components/reports/index.js";
import { CustomerLedgerReportContent } from "./CustomerLedgerPage.jsx";
import { VendorLedgerReportContent } from "./VendorLedgerPage.jsx";
import "./MergedReportsPage.css";

const ALL_TABS = [
  { id: "customer", label: "Customer Ledger", perm: () => can("CUSTOMERS", "VIEW") },
  { id: "supplier", label: "Supplier Ledger", perm: () => can("VENDORS", "VIEW") }
];

export default function LedgerReportsPage() {
  const tabs = useMemo(() => ALL_TABS.filter((t) => t.perm()), []);
  const canAny = tabs.length > 0;
  const defaultTab = tabs[0]?.id || "customer";
  const [params, setParams] = useSearchParams();
  const urlTabRaw = String(params.get("tab") || "");
  const urlTab = tabs.some((t) => t.id === urlTabRaw) ? urlTabRaw : defaultTab;
  const [tab, setTab] = useState(urlTab);

  useEffect(() => setTab(urlTab), [urlTab]);

  useEffect(() => {
    if (!canAny) return;
    if (!tabs.some((t) => t.id === urlTabRaw)) {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("tab", defaultTab);
          return p;
        },
        { replace: true }
      );
    }
  }, [canAny, defaultTab, setParams, tabs, urlTabRaw]);

  const activeLabel = useMemo(() => tabs.find((t) => t.id === tab)?.label || tabs[0]?.label || "Ledger", [tab, tabs]);

  if (!canAny) return <ReportDenied title="Ledger" message="You don’t have permission to view these ledgers." />;

  function setActive(nextId) {
    const next = tabs.some((t) => t.id === nextId) ? nextId : defaultTab;
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
      <div className="pageWrap">
        <ReportPageIntro title="Ledger" subtitle={`Chaino Pharma > Reports > Ledger${activeLabel ? ` > ${activeLabel}` : ""}`} />

        <div className="mrTabs" role="tablist" aria-label="Ledger tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`mrTab${tab === t.id ? " mrTab_active" : ""}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mrBody" role="tabpanel">
          {tab === "customer" ? <CustomerLedgerReportContent embedded /> : null}
          {tab === "supplier" ? <VendorLedgerReportContent embedded /> : null}
        </div>
      </div>
    </ReportShell>
  );
}
