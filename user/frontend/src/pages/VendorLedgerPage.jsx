import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { can } from "../utils/access.js";
import { parseApiError } from "../utils/api.js";
import { emitToast } from "../services/toastBus.js";
import { listVendors } from "../services/vendorService.js";
import { getVendorLedger } from "../services/purchaseService.js";
import { fmtDateIndian } from "../utils/format.js";
import { ReportShell, ReportDenied, ReportPageIntro, ReportCard, ReportToolbar, ReportToolbarFilters, ReportTableScroll } from "../components/reports/index.js";

export function VendorLedgerReportContent({ embedded = false } = {}) {
  const { id: routeId } = useParams();
  const canView = can("VENDORS", "VIEW");
  const [busy, setBusy] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState(routeId || "");
  const [doc, setDoc] = useState(null);

  useEffect(() => setVendorId(routeId || ""), [routeId]);

  async function loadMasters() {
    const c = await listVendors({ limit: 500 });
    if (c.status >= 200 && c.status < 300 && c.json?.ok) setVendors(c.json?.data?.vendors || []);
  }
  async function refresh(id) {
    if (!id) return;
    setBusy(true);
    const r = await getVendorLedger(id);
    if (r.status >= 200 && r.status < 300 && r.json?.ok) setDoc(r.json?.data || null);
    else if (r.status !== 401) emitToast({ type: "error", message: parseApiError(r) });
    setBusy(false);
  }
  useEffect(() => { if (canView) loadMasters(); }, [canView]);
  useEffect(() => { if (canView && vendorId) refresh(vendorId); }, [canView, vendorId]);

  const entries = useMemo(() => doc?.entries || [], [doc]);
  if (!canView) return <ReportDenied title="Supplier Ledger" message="You don’t have permission to view this report." />;

  const body = (
    <div className={embedded ? "" : "pageWrap"}>
      {embedded ? null : <ReportPageIntro title="Supplier Ledger" subtitle="Purchase, payment and return entries with running balance." />}
      <ReportCard busy={busy}>
        <ReportToolbar>
          <ReportToolbarFilters>
            <label className="rptToolbarHint" htmlFor="vendor-ledger-select">Supplier</label>
            <select id="vendor-ledger-select" className="rptSearchInput" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select supplier</option>
              {(vendors || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </ReportToolbarFilters>
        </ReportToolbar>
        <div style={{ padding: 12 }}>
          {doc?.summary ? (
            <div className="raSub" style={{ marginBottom: 8 }}>
              Net: ₹{Number(doc.summary.net_balance || 0).toFixed(2)} ({doc.summary.net_balance_type})
            </div>
          ) : null}
          <ReportTableScroll>
            <table className="rptBatchTable">
              <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Dr</th><th>Cr</th><th>Balance</th></tr></thead>
              <tbody>
                {entries.length ? (
                  entries.map((e, i) => (
                    <tr key={`${e.date}-${i}`}>
                      <td>{fmtDateIndian(e.date)}</td>
                      <td>{String(e.type || "").replaceAll("_", " ")}</td>
                      <td>{e.reference || ""}</td>
                      <td>{Number(e.debit || 0) ? Number(e.debit || 0).toFixed(2) : ""}</td>
                      <td>{Number(e.credit || 0) ? Number(e.credit || 0).toFixed(2) : ""}</td>
                      <td>{Number(e.balance || 0).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="rptListEmpty">
                      {vendorId ? "No ledger entries for this supplier." : "Select a supplier to view ledger entries."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ReportTableScroll>
        </div>
      </ReportCard>
    </div>
  );

  return embedded ? body : <ReportShell>{body}</ReportShell>;
}

export default function VendorLedgerPage() {
  return <VendorLedgerReportContent embedded={false} />;
}
