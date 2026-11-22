import { AsyncButton } from "../components/ui/buttons.jsx";
import { useEffect, useState } from "react";
import { can } from "../utils/access.js";
import { parseApiError } from "../utils/api.js";
import { emitToast } from "../services/toastBus.js";
import { getDayBookReport } from "../services/reportService.js";
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

export default function DayBookReportPage() {
  const canView = can("SALES_INVOICES", "VIEW");
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayYmdLocal());
  const [data, setData] = useState(null);

  async function refresh(d) {
    setBusy(true);
    const r = await getDayBookReport({ date: d });
    if (r.status >= 200 && r.status < 300 && r.json?.ok) setData(r.json?.data || null);
    else if (r.status !== 401) emitToast({ type: "error", message: parseApiError(r) });
    setBusy(false);
  }

  useEffect(() => {
    if (!canView) return;
    refresh(date);
  }, [canView]);

  if (!canView) return <ReportDenied title="Day Book" message="You don’t have permission to view this report." />;

  const rec = data?.receipts || {};
  const pay = data?.payments || {};
  const cash = data?.cash_position || {};
  const money = (v) => fmtMoneyINR(v) || "₹0.00";

  return (
    <ReportShell>
      <div className="pageWrap">
        <ReportPageIntro
          title="Day Book"
          subtitle={
            <>
              Quick daily summary for <strong>{fmtDateIndian(data?.date || date)}</strong>  what money came in, what went out,
              and how much cash should be in hand now.
            </>
          }
        />
        <ReportCard busy={busy}>
          <ReportToolbar>
            <ReportToolbarFilters>
              <label className="rptToolbarHint" htmlFor="day-book-date">Date</label>
              <input id="day-book-date" type="date" className="rptSearchInput rptSearchInput_narrow" value={date} onChange={(e) => setDate(e.target.value)} />
              <AsyncButton variant="ghost" size="sm" type="button" onClick={() => refresh(date)} loading={busy} loadingText="Applying…">
                Apply
              </AsyncButton>
            </ReportToolbarFilters>
          </ReportToolbar>
          <div style={{ padding: 16, display: "grid", gap: 12 }}>
            <div
              className="pageCard"
              style={{ padding: 12, borderLeft: "4px solid var(--color-primary)", background: "var(--color-surface, #f8fafc)" }}
            >
              <div className="raTitle" style={{ fontSize: 13, marginBottom: 6 }}>Why this report?</div>
              <div className="raSub" style={{ lineHeight: 1.5 }}>
                Use Day Book at closing time to verify:
                <strong> cash received</strong>, <strong>cash paid</strong>, and
                <strong> expected cash in hand</strong>.
              </div>
            </div>

            <div className="pageCard" style={{ padding: 12 }}>
              <div className="raTitle" style={{ fontSize: 13 }}>1) Money In (Receipts)</div>
              <div className="raSub">Cash Sales (walk-in): <strong>{money(rec.cash_sales)}</strong></div>
              <div className="raSub">Credit Sales (billed): <strong>{money(rec.credit_sales)}</strong></div>
              <div className="raSub">Customer Payments Received: <strong>{money(rec.customer_receipts)}</strong></div>
              <div className="raSub" style={{ marginTop: 6, fontWeight: 800 }}>Total Receipts: {money(rec.total_receipts)}</div>
            </div>

            <div className="pageCard" style={{ padding: 12 }}>
              <div className="raTitle" style={{ fontSize: 13 }}>2) Money Out (Payments)</div>
              <div className="raSub">Supplier Payments: <strong>{money(pay.supplier_payments)}</strong></div>
              <div className="raSub" style={{ marginTop: 6, fontWeight: 800 }}>Total Payments: {money(pay.total_payments)}</div>
            </div>

            <div className="pageCard" style={{ padding: 12, border: "2px solid var(--color-primary)" }}>
              <div className="raTitle" style={{ fontSize: 13 }}>3) Cash In Hand</div>
              <div className="raSub">Opening Cash: {money(cash.opening_cash)}</div>
              <div className="raSub">+ Cash Received: {money(cash.cash_received)}</div>
              <div className="raSub">- Cash Paid: {money(cash.cash_paid)}</div>
              <div className="raSub" style={{ marginTop: 6, fontSize: 15, fontWeight: 900 }}>
                Closing Cash (Expected): {money(cash.closing_cash)}
              </div>
            </div>
          </div>
        </ReportCard>
      </div>
    </ReportShell>
  );
}
