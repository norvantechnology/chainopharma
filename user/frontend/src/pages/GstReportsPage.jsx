import { AsyncButton } from "../components/ui/buttons.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { can } from "../utils/access.js";
import { parseApiError } from "../utils/api.js";
import { emitToast } from "../services/toastBus.js";
import { onAuthChanged } from "../services/authStorage.js";
import { getGstr1Report, getGstr2Report } from "../services/reportService.js";
import { downloadCsvFile } from "../components/reports/reportExport.js";
import { fmtDateIndian, fmtMoneyINR } from "../utils/format.js";
import { todayYmdLocal } from "../utils/date.js";
import {
  ReportShell,
  ReportDenied,
  ReportPageIntro,
  ReportCard,
  ReportToolbar,
  ReportToolbarFilters
} from "../components/reports/index.js";
import "./MergedReportsPage.css";

const TABS = [
  { id: "gstr1", label: "GSTR-1", hint: "Sales / outward supplies" },
  { id: "gstr2", label: "GSTR-2", hint: "Purchases / inward supplies" }
];

function money(v) {
  return fmtMoneyINR(v) || "₹0.00";
}

function monthStart(ymd) {
  return `${String(ymd || todayYmdLocal()).slice(0, 7)}-01`;
}

function clampTab(id) {
  return TABS.some((t) => t.id === id) ? id : "gstr1";
}

function SummaryGrid({ items }) {
  return (
    <div className="gstSummaryGrid">
      {items.map((it) => (
        <div key={it.label} className="pageCard gstSummaryCard">
          <div className="raSub gstSummaryLabel">{it.label}</div>
          <div className="raTitle gstSummaryValue">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ columns, rows, emptyText }) {
  if (!rows?.length) {
    return <div className="raSub gstEmpty">{emptyText || "No rows in this period."}</div>;
  }
  return (
    <div className="gstTableWrap">
      <table className="ct gstTable">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className || ""}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || row.invoice_id || row.return_id || `${row.hsn_code || "r"}-${idx}`}>
              {columns.map((c) => (
                <td key={c.key} className={c.className || ""}>
                  {typeof c.value === "function" ? c.value(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Gstr1Panel({ dateFrom, dateTo }) {
  const canView = can("SALES_INVOICES", "VIEW");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [section, setSection] = useState("b2b");
  const [loadedOnce, setLoadedOnce] = useState(false);

  async function refresh(from, to) {
    setBusy(true);
    const r = await getGstr1Report({ date_from: from, date_to: to });
    if (r.status >= 200 && r.status < 300 && r.json?.ok) {
      const next = r.json?.data || null;
      setData(next);
      // Prefer a section that actually has rows after first load / period change
      const order = ["b2b", "b2c", "cdn", "hsn"];
      const firstWithRows = order.find((id) => (next?.[id] || []).length > 0);
      if (firstWithRows) setSection(firstWithRows);
    } else if (r.status !== 401) {
      emitToast({ type: "error", message: parseApiError(r) });
    }
    setBusy(false);
    setLoadedOnce(true);
  }

  useEffect(() => {
    if (!canView) return;
    refresh(dateFrom, dateTo);
  }, [canView, dateFrom, dateTo]);

  const s = data?.summary || {};
  const sectionMeta = [
    { id: "b2b", label: "B2B", count: (data?.b2b || []).length },
    { id: "b2c", label: "B2C", count: (data?.b2c || []).length },
    { id: "cdn", label: "CDN / Returns", count: (data?.cdn || []).length },
    { id: "hsn", label: "HSN summary", count: (data?.hsn || []).length }
  ];

  const rows =
    section === "b2c"
      ? data?.b2c || []
      : section === "cdn"
        ? data?.cdn || []
        : section === "hsn"
          ? data?.hsn || []
          : data?.b2b || [];

  const columns = useMemo(() => {
    if (section === "hsn") {
      return [
        { key: "hsn_code", label: "HSN" },
        { key: "gst_percent", label: "GST%", className: "c", value: (r) => `${r.gst_percent}%` },
        { key: "qty", label: "Qty", className: "c" },
        { key: "taxable", label: "Taxable", className: "r", value: (r) => money(r.taxable) },
        { key: "cgst", label: "CGST", className: "r", value: (r) => money(r.cgst) },
        { key: "sgst", label: "SGST", className: "r", value: (r) => money(r.sgst) },
        { key: "igst", label: "IGST", className: "r", value: (r) => money(r.igst) }
      ];
    }
    if (section === "cdn") {
      return [
        { key: "return_number", label: "Credit note / Return" },
        { key: "return_date", label: "Date", value: (r) => fmtDateIndian(r.return_date) },
        { key: "customer_gstin", label: "GSTIN", value: (r) => r.customer_gstin || "—" },
        { key: "customer_name", label: "Customer" },
        { key: "original_invoice", label: "Original inv.", value: (r) => r.original_invoice || "—" },
        { key: "taxable", label: "Taxable", className: "r", value: (r) => money(r.taxable) },
        {
          key: "gst",
          label: "Tax",
          className: "r",
          value: (r) => money((r.cgst || 0) + (r.sgst || 0) + (r.igst || 0))
        },
        { key: "note_value", label: "Note value", className: "r", value: (r) => money(r.note_value) }
      ];
    }
    return [
      { key: "invoice_number", label: "Invoice" },
      { key: "invoice_date", label: "Date", value: (r) => fmtDateIndian(r.invoice_date) },
      { key: "customer_gstin", label: "GSTIN", value: (r) => r.customer_gstin || "—" },
      { key: "customer_name", label: "Customer" },
      { key: "bill_type", label: "Type" },
      { key: "taxable", label: "Taxable", className: "r", value: (r) => money(r.taxable) },
      { key: "cgst", label: "CGST", className: "r", value: (r) => money(r.cgst) },
      { key: "sgst", label: "SGST", className: "r", value: (r) => money(r.sgst) },
      { key: "invoice_value", label: "Invoice value", className: "r", value: (r) => money(r.invoice_value) }
    ];
  }, [section]);

  if (!canView) {
    return <ReportDenied title="GSTR-1" message="You need Sales Invoice view permission." />;
  }

  function exportCsv() {
    downloadCsvFile(
      `gstr1-${section}-${dateFrom}_${dateTo}.csv`,
      columns.map((c) => ({ key: c.key, label: c.label, value: c.value })),
      rows
    );
  }

  return (
    <ReportCard busy={busy}>
      {!busy && loadedOnce && !(data?.b2b?.length || data?.b2c?.length || data?.cdn?.length) ? (
        <div className="mrHint">
          No confirmed sales invoices in this period. Try a wider date range, then tap <strong>Apply</strong>.
        </div>
      ) : null}
      <SummaryGrid
        items={[
          { label: "B2B invoices", value: s.b2b_count ?? "—" },
          { label: "B2B taxable", value: money(s.b2b_taxable) },
          { label: "B2C invoices", value: s.b2c_count ?? "—" },
          { label: "CDN / returns", value: s.cdn_count ?? "—" },
          { label: "HSN groups", value: s.hsn_count ?? "—" }
        ]}
      />
      <div className="mrTabs mrTabs_scroll" role="tablist" aria-label="GSTR-1 sections">
        {sectionMeta.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={section === t.id}
            className={`mrTab${section === t.id ? " mrTab_active" : ""}`}
            onClick={() => setSection(t.id)}
          >
            {t.label}
            <span className="mrTabCount">{t.count}</span>
          </button>
        ))}
        <div className="mrTabsActions">
          <AsyncButton variant="ghost" size="sm" type="button" onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </AsyncButton>
        </div>
      </div>
      <SimpleTable columns={columns} rows={rows} emptyText={`No ${section.toUpperCase()} rows for this period.`} />
      {Array.isArray(data?.limitations) && data.limitations.length ? (
        <div className="raSub gstLimitations">
          {data.limitations.map((x) => (
            <div key={x}>• {x}</div>
          ))}
        </div>
      ) : null}
    </ReportCard>
  );
}

function Gstr2Panel({ dateFrom, dateTo }) {
  const canView = can("PURCHASE_INVOICES", "VIEW");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [section, setSection] = useState("b2b");
  const [loadedOnce, setLoadedOnce] = useState(false);

  async function refresh(from, to) {
    setBusy(true);
    const r = await getGstr2Report({ date_from: from, date_to: to });
    if (r.status >= 200 && r.status < 300 && r.json?.ok) {
      const next = r.json?.data || null;
      setData(next);
      const order = ["b2b", "cdn", "hsn"];
      const firstWithRows = order.find((id) => (next?.[id] || []).length > 0);
      if (firstWithRows) setSection(firstWithRows);
    } else if (r.status !== 401) {
      emitToast({ type: "error", message: parseApiError(r) });
    }
    setBusy(false);
    setLoadedOnce(true);
  }

  useEffect(() => {
    if (!canView) return;
    refresh(dateFrom, dateTo);
  }, [canView, dateFrom, dateTo]);

  const s = data?.summary || {};
  const sectionMeta = [
    { id: "b2b", label: "B2B purchases", count: (data?.b2b || []).length },
    { id: "cdn", label: "CDN / Returns", count: (data?.cdn || []).length },
    { id: "hsn", label: "HSN summary", count: (data?.hsn || []).length }
  ];

  const rows =
    section === "cdn" ? data?.cdn || [] : section === "hsn" ? data?.hsn || [] : data?.b2b || [];

  const columns = useMemo(() => {
    if (section === "hsn") {
      return [
        { key: "hsn_code", label: "HSN" },
        { key: "gst_percent", label: "GST%", className: "c", value: (r) => `${r.gst_percent}%` },
        { key: "qty", label: "Qty", className: "c" },
        { key: "taxable", label: "Taxable", className: "r", value: (r) => money(r.taxable) },
        { key: "cgst", label: "CGST", className: "r", value: (r) => money(r.cgst) },
        { key: "sgst", label: "SGST", className: "r", value: (r) => money(r.sgst) },
        { key: "gst", label: "GST", className: "r", value: (r) => money(r.gst) }
      ];
    }
    if (section === "cdn") {
      return [
        { key: "return_number", label: "Return #" },
        { key: "credit_note_number", label: "Supplier CN", value: (r) => r.credit_note_number || "—" },
        { key: "return_date", label: "Date", value: (r) => fmtDateIndian(r.return_date) },
        { key: "supplier_gstin", label: "GSTIN", value: (r) => r.supplier_gstin || "—" },
        { key: "supplier_name", label: "Supplier" },
        { key: "original_invoice", label: "Our PI", value: (r) => r.original_invoice || "—" },
        { key: "taxable", label: "Taxable", className: "r", value: (r) => money(r.taxable) },
        { key: "note_value", label: "Note value", className: "r", value: (r) => money(r.note_value) }
      ];
    }
    return [
      { key: "invoice_number", label: "Our invoice" },
      { key: "vendor_invoice_number", label: "Supplier bill", value: (r) => r.vendor_invoice_number || "—" },
      { key: "invoice_date", label: "Date", value: (r) => fmtDateIndian(r.invoice_date) },
      { key: "supplier_gstin", label: "GSTIN", value: (r) => r.supplier_gstin || "—" },
      { key: "supplier_name", label: "Supplier" },
      { key: "taxable", label: "Taxable", className: "r", value: (r) => money(r.taxable) },
      { key: "cgst", label: "CGST", className: "r", value: (r) => money(r.cgst) },
      { key: "sgst", label: "SGST", className: "r", value: (r) => money(r.sgst) },
      { key: "invoice_value", label: "Invoice value", className: "r", value: (r) => money(r.invoice_value) }
    ];
  }, [section]);

  if (!canView) {
    return <ReportDenied title="GSTR-2" message="You need Purchase Invoice view permission." />;
  }

  function exportCsv() {
    downloadCsvFile(
      `gstr2-${section}-${dateFrom}_${dateTo}.csv`,
      columns.map((c) => ({ key: c.key, label: c.label, value: c.value })),
      rows
    );
  }

  return (
    <ReportCard busy={busy}>
      {!busy && loadedOnce && !(data?.b2b?.length || data?.cdn?.length) ? (
        <div className="mrHint">
          No confirmed purchase invoices in this period. Try a wider date range, then tap <strong>Apply</strong>.
        </div>
      ) : null}
      <SummaryGrid
        items={[
          { label: "Purchase invoices", value: s.b2b_count ?? "—" },
          { label: "Taxable", value: money(s.b2b_taxable) },
          { label: "GST", value: money(s.b2b_gst) },
          { label: "CDN / returns", value: s.cdn_count ?? "—" },
          { label: "HSN groups", value: s.hsn_count ?? "—" }
        ]}
      />
      <div className="mrTabs mrTabs_scroll" role="tablist" aria-label="GSTR-2 sections">
        {sectionMeta.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={section === t.id}
            className={`mrTab${section === t.id ? " mrTab_active" : ""}`}
            onClick={() => setSection(t.id)}
          >
            {t.label}
            <span className="mrTabCount">{t.count}</span>
          </button>
        ))}
        <div className="mrTabsActions">
          <AsyncButton variant="ghost" size="sm" type="button" onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </AsyncButton>
        </div>
      </div>
      <SimpleTable columns={columns} rows={rows} emptyText={`No ${section.toUpperCase()} rows for this period.`} />
      {Array.isArray(data?.limitations) && data.limitations.length ? (
        <div className="raSub gstLimitations">
          {data.limitations.map((x) => (
            <div key={x}>• {x}</div>
          ))}
        </div>
      ) : null}
    </ReportCard>
  );
}

export default function GstReportsPage() {
  const [authTick, setAuthTick] = useState(0);
  useEffect(() => onAuthChanged(() => setAuthTick((t) => t + 1)), []);

  // Re-evaluate permissions when access finishes loading after login/refresh.
  // eslint-disable-next-line no-unused-vars
  const _ = authTick;
  const canSales = can("SALES_INVOICES", "VIEW");
  const canPurchase = can("PURCHASE_INVOICES", "VIEW");
  const canAny = canSales || canPurchase;

  const [params, setParams] = useSearchParams();
  const urlTab = clampTab(params.get("tab"));
  const [tab, setTab] = useState(urlTab);
  const today = todayYmdLocal();
  const [dateFrom, setDateFrom] = useState(params.get("date_from") || monthStart(today));
  const [dateTo, setDateTo] = useState(params.get("date_to") || today);
  const [applied, setApplied] = useState({ from: dateFrom, to: dateTo });
  const [applyFlash, setApplyFlash] = useState("");

  useEffect(() => {
    setTab(urlTab);
  }, [urlTab]);

  const availableTabs = useMemo(
    () => TABS.filter((t) => (t.id === "gstr1" ? canSales : canPurchase)),
    [canSales, canPurchase]
  );

  const setActive = useCallback(
    (nextId) => {
      const next = clampTab(nextId);
      if (!availableTabs.some((t) => t.id === next)) return;
      setTab(next);
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("tab", next);
          return p;
        },
        { replace: true }
      );
    },
    [availableTabs, setParams]
  );

  useEffect(() => {
    if (!availableTabs.length) return;
    if (!availableTabs.some((t) => t.id === tab)) {
      setActive(availableTabs[0].id);
    }
  }, [availableTabs, tab, setActive]);

  if (!canAny) {
    return <ReportDenied title="GST Returns" message="You don’t have permission to view GST reports." />;
  }

  function applyPeriod() {
    const from = dateFrom || monthStart(today);
    const to = dateTo || today;
    const normalized = from > to ? { from: to, to: from } : { from, to };
    setDateFrom(normalized.from);
    setDateTo(normalized.to);
    setApplied(normalized);
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", tab);
        p.set("date_from", normalized.from);
        p.set("date_to", normalized.to);
        return p;
      },
      { replace: true }
    );
    setApplyFlash(`Showing ${fmtDateIndian(normalized.from)} → ${fmtDateIndian(normalized.to)}`);
    window.setTimeout(() => setApplyFlash(""), 2500);
  }

  const activeHint = TABS.find((t) => t.id === tab)?.hint || "";

  return (
    <ReportShell>
      <div className="pageWrap gstPage">
        <ReportPageIntro
          title="GST Returns"
          subtitle={
            <>
              Working papers for <strong>GSTR-1</strong> (sales) and <strong>GSTR-2</strong> (purchases) from confirmed
              invoices. Period{" "}
              <strong>
                {fmtDateIndian(applied.from)} → {fmtDateIndian(applied.to)}
              </strong>
              .
            </>
          }
        />

        <ReportToolbar>
          <ReportToolbarFilters>
            <label className="rptToolbarHint" htmlFor="gst-from">
              From
            </label>
            <input
              id="gst-from"
              type="date"
              className="rptSearchInput rptSearchInput_narrow"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <label className="rptToolbarHint" htmlFor="gst-to">
              To
            </label>
            <input
              id="gst-to"
              type="date"
              className="rptSearchInput rptSearchInput_narrow"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <button className="appBtn appBtn_primary appBtn_sm" type="button" onClick={applyPeriod}>
              Apply
            </button>
            {applyFlash ? <span className="rptToolbarHint">{applyFlash}</span> : null}
          </ReportToolbarFilters>
        </ReportToolbar>

        <div className="mrTabs" role="tablist" aria-label="GST return type">
          {availableTabs.map((t) => (
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
        {activeHint ? <div className="raSub gstTabHint">{activeHint}</div> : null}

        <div className="mrBody" role="tabpanel">
          {tab === "gstr1" && canSales ? <Gstr1Panel dateFrom={applied.from} dateTo={applied.to} /> : null}
          {tab === "gstr2" && canPurchase ? <Gstr2Panel dateFrom={applied.from} dateTo={applied.to} /> : null}
        </div>
      </div>
    </ReportShell>
  );
}
