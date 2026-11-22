import { useEffect, useMemo, useState } from "react";
import { emitToast } from "../services/toastBus.js";
import { parseApiError } from "../utils/api.js";
import { can } from "../utils/access.js";
import { getNonMovingReport } from "../services/reportService.js";
import {
  ReportShell,
  ReportDenied,
  ReportPageIntro,
  ReportCard,
  ReportToolbar,
  ReportToolbarPrim,
  ReportToolbarFilters,
  ReportSearchInput,
  ReportCountChip,
  ReportListEmpty,
  ReportTableScroll,
  ReportPaneBody,
  filterReportItemsBySearch
} from "../components/reports/index.js";
import { fmtDateIndian } from "../utils/format.js";

export function NonMovingReportContent({ embedded = false } = {}) {
  const canView = can("PRODUCT_BATCHES", "VIEW");

  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(90);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [thresholdDays, setThresholdDays] = useState(90);

  async function refresh(daysParam) {
    setBusy(true);
    const params = {};
    if (Number(daysParam) > 0) params.days = Number(daysParam);
    const resp = await getNonMovingReport(params);
    if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
      const data = resp.json?.data || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setThresholdDays(Number(data.thresholdDays || 90));
    } else if (resp.status !== 401) {
      emitToast({ type: "error", message: parseApiError(resp) });
    }
    setBusy(false);
  }

  useEffect(() => {
    if (!canView) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const filtered = useMemo(() => filterReportItemsBySearch(items, search), [items, search]);

  if (!canView) {
    return (
      <ReportDenied title="Non-Moving Report" message="You don’t have permission to view this report." />
    );
  }

  const body = (
    <div className={embedded ? "" : "pageWrap"}>
      {embedded ? null : (
        <ReportPageIntro
          title="Non Moving Report"
          subtitle={
            <>
              Batches with stock but no SALE in the last <strong>{thresholdDays}</strong> days. Use this to plan
              returns, schemes or push these items at the counter.
            </>
          }
        />
      )}

      <ReportCard busy={busy}>
          <ReportToolbar>
            <ReportToolbarPrim>
              <ReportSearchInput
                placeholder="Search product / batch / supplier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <ReportCountChip busy={busy}>{`${filtered.length} item(s)`}</ReportCountChip>
            </ReportToolbarPrim>
            <ReportToolbarFilters>
              <label className="rptToolbarHint" htmlFor="nonmoving-days">
                Idle days
              </label>
              <input
                id="nonmoving-days"
                type="number"
                className="rptSearchInput rptSearchInput_narrow"
                min={1}
                step={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
              <button className="appBtn appBtn_primary appBtn_sm" type="button" onClick={() => refresh(days)} disabled={busy}>
                Apply
              </button>
            </ReportToolbarFilters>
          </ReportToolbar>

          <ReportPaneBody>
            {filtered.length === 0 ? (
              <ReportListEmpty busy={busy}>
                {busy ? null : "No non-moving stock for the selected window."}
              </ReportListEmpty>
            ) : (
              <>
                <div className="invNmCards" aria-label="Non-moving stock cards">
                  {filtered.map((r) => {
                    const strips = Number(r.current_stock || 0);
                    const loose = Number(r.loose_stock || 0);
                    return (
                      <article key={`card-${r.batch_id}`} className="invNmCard">
                        <div className="invNmCardTop">
                          <div className="rptVendorContact">
                            <span className="rptVendorName">{r.product_name || r.product_code || ""}</span>
                            {r.drug_name ? <span className="rptVendorAddress">{r.drug_name}</span> : null}
                          </div>
                          <span className="invNmIdle">{r.days_since_last_sale != null ? `${r.days_since_last_sale}d idle` : "Idle"}</span>
                        </div>
                        <div className="invNmMeta">
                          <span>Batch {r.batch_no || "—"}</span>
                          <span>{r.mfg_name || "—"}</span>
                          <span>{r.supplier_name || "—"}</span>
                        </div>
                        <div className="invNmStock">
                          <span>{strips} strip{strips === 1 ? "" : "s"}</span>
                          {loose > 0 ? <span>{loose} tab{loose === 1 ? "" : "s"}</span> : null}
                          <span>Last sold: {r.last_sale_date ? fmtDateIndian(r.last_sale_date) : "Never"}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <ReportTableScroll className="invNmTableWrap">
                  <table className="rptBatchTable invNmTable">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Batch</th>
                        <th>Mfg</th>
                        <th>Supplier</th>
                        <th className="rptNum">Strips</th>
                        <th className="rptNum">Tabs</th>
                        <th>Last sold</th>
                        <th>Days idle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.batch_id}>
                          <td>
                            <div className="rptVendorContact">
                              <span className="rptVendorName">{r.product_name || r.product_code || ""}</span>
                              {r.drug_name ? <span className="rptVendorAddress">{r.drug_name}</span> : null}
                            </div>
                          </td>
                          <td>{r.batch_no || ""}</td>
                          <td>{r.mfg_name || ""}</td>
                          <td>{r.supplier_name || ""}</td>
                          <td className="rptNum">{Number(r.current_stock || 0)}</td>
                          <td className="rptNum">{Number(r.loose_stock || 0) || ""}</td>
                          <td>{r.last_sale_date ? fmtDateIndian(r.last_sale_date) : "Never"}</td>
                          <td>{r.days_since_last_sale != null ? `${r.days_since_last_sale}d` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ReportTableScroll>
              </>
            )}
          </ReportPaneBody>
      </ReportCard>
    </div>
  );

  return embedded ? body : <ReportShell>{body}</ReportShell>;
}

export default function NonMovingReportPage() {
  return <NonMovingReportContent embedded={false} />;
}
