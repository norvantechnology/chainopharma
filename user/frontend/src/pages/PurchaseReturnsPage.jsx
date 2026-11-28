import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../layouts/AppShell.jsx";
import CommonTable from "../components/CommonTable.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { readAuth } from "../services/authStorage.js";
import { isRetailerAuth } from "../utils/businessRole.js";
import { can } from "../utils/access.js";
import { confirmPurchaseReturn, listPurchaseReturns } from "../services/purchaseService.js";
import { listVendors } from "../services/vendorService.js";
import { parseApiError } from "../utils/api.js";
import { emitToast } from "../services/toastBus.js";
import { NAV_LABELS } from "../constants/navLabels.js";
import "../components/StructuredForm.css";
import { IconBtn, IconConfirm } from "../components/TableActionKit.jsx";

export default function PurchaseReturnsPage() {
  const navigate = useNavigate();
  const auth = readAuth();
  const user = auth?.user || null;
  const isRetailer = isRetailerAuth(auth);
  const canView = can("PURCHASE_RETURNS", "VIEW");
  const canAdd = can("PURCHASE_RETURNS", "ADD");
  const canUpdate = can("PURCHASE_RETURNS", "UPDATE");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [confirm, setConfirm] = useState({ open: false, id: "" });

  async function refresh() {
    setBusy(true);
    const [r, v] = await Promise.all([
      listPurchaseReturns({ search, status: statusFilter, vendorId: vendorFilter, dateFrom, dateTo, limit: 500 }),
      listVendors({ limit: 500 })
    ]);
    if (r.status >= 200 && r.status < 300 && r.json?.ok) {
      setRows(r.json?.data?.items || []);
    } else if (r.status !== 401) {
      emitToast({ type: "error", message: parseApiError(r) });
      setRows([]);
    }
    if (v.status >= 200 && v.status < 300 && v.json?.ok) setVendors(v.json?.data?.vendors || v.json?.data?.items || []);
    setBusy(false);
  }

  useEffect(() => {
    if (canView) refresh();
  }, [canView, search, statusFilter, vendorFilter, dateFrom, dateTo]);

  if (!canView) {
    return (
      <AppShell
        userName={user?.full_name || "User"}
        userEmail={user?.email || auth?.email || ""}
        userBusinessName={user?.firm_name || ""}
        userGstNumber={user?.gst_number || ""}
        variant="user"
      >
        <div className="pageWrap">
          <div className="pageCard">
            <div className="raTitle">{NAV_LABELS.purchaseReturns}</div>
            <div className="raSub">You do not have permission to view purchase returns.</div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      userName={user?.full_name || "User"}
      userEmail={user?.email || auth?.email || ""}
      userBusinessName={user?.firm_name || ""}
      userGstNumber={user?.gst_number || ""}
      variant="user"
    >
      <div className="pageWrap">
        <div className="raTop">
          <div>
            <div className="raTitle">{NAV_LABELS.purchaseReturns}</div>
          </div>
        </div>
        <div className="pageCard">
          <CommonTable
            title=""
            subtitle=""
            compact
            countText={busy ? "Loading..." : `${rows.length} returns`}
            search={search}
            onSearchChange={setSearch}
            filters={[
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "", label: "All status" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "CONFIRMED", label: "Confirmed" },
                  { value: "CANCELLED", label: "Cancelled" }
                ]
              },
              ...(isRetailer
                ? [
                    {
                      id: "vendor",
                      label: "Supplier",
                      value: vendorFilter,
                      onChange: setVendorFilter,
                      options: [
                        { value: "", label: "All suppliers" },
                        ...(vendors || []).map((x) => ({ value: x.id, label: x.name || x.code || String(x.id) }))
                      ]
                    }
                  ]
                : []),
              { id: "from", type: "date", label: "From", value: dateFrom, onChange: setDateFrom },
              { id: "to", type: "date", label: "To", value: dateTo, onChange: setDateTo }
            ]}
            primaryAction={
              canAdd
                ? {
                    label: "New return",
                    onClick: () => navigate("/purchase-invoices")
                  }
                : null
            }
            rows={rows}
            getRowId={(r) => r.id}
            columns={[
              { id: "return_number", header: "Return No", render: (r) => <span style={{ fontWeight: 700 }}>{r.return_number}</span> },
              { id: "party_name", header: isRetailer ? "Supplier" : "Party", render: (r) => r.party_name || "" },
              { id: "invoice_number", header: "Purchase Invoice", sortable: false, render: (r) => r.invoice_number || "" },
              { id: "return_date", header: "Date", render: (r) => String(r.return_date || "").slice(0, 10) },
              { id: "status", header: "Status", render: (r) => <span style={{ fontWeight: 700 }}>{r.status}</span> },
              { id: "total_amount", header: "Amount", align: "right", render: (r) => Number(r.total_amount || 0).toFixed(2) },
              {
                id: "actions",
                header: "Actions",
                align: "right",
                sortable: false,
                render: (r) => (
                  <div className="ibGroup" onClick={(e) => e.stopPropagation()}>
                    {r.status === "DRAFT" && canUpdate ? (
                      <IconBtn tooltip="Confirm return" variant="success" onClick={() => setConfirm({ open: true, id: r.id })}>
                        <IconConfirm />
                      </IconBtn>
                    ) : null}
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirm.open}
        title="Confirm purchase return"
        message="Confirm this return? Stock will be reduced for the returned quantities."
        confirmLabel="Confirm"
        busy={busy}
        onClose={() => setConfirm({ open: false, id: "" })}
        onConfirm={async () => {
          setBusy(true);
          const resp = await confirmPurchaseReturn(confirm.id, {});
          if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
            emitToast({ type: "success", message: resp.json?.meta?.message || "Purchase return confirmed." });
            setConfirm({ open: false, id: "" });
            await refresh();
          } else if (resp.status !== 401) {
            emitToast({ type: "error", message: parseApiError(resp) });
          }
          setBusy(false);
        }}
      />
    </AppShell>
  );
}
