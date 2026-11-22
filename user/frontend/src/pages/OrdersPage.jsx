import { AppButton, InlineButtonProgress } from "../components/ui/buttons.jsx";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../layouts/AppShell.jsx";
import CommonTable from "../components/CommonTable.jsx";
import CommonModal from "../components/CommonModal.jsx";
import { OrderDetailFacts, OrderDetailFulfillment } from "../components/orders/OrderDetailSummary.jsx";
import { readAuth } from "../services/authStorage.js";
import { isRetailerAuth } from "../utils/businessRole.js";
import { parseApiError } from "../utils/api.js";
import { emitToast } from "../services/toastBus.js";
import { can } from "../utils/access.js";
import {
  acceptOrder,
  cancelOrderRetailer,
  confirmDelivery,
  createPurchaseFromOrder,
  dispatchOrder,
  getOrderById,
  getWholesalerOrderView,
  listIncomingOrders,
  listMyOrders,
  rejectOrder
} from "../services/orderService.js";
import OrdersQuickActions from "../components/orders/OrdersQuickActions.jsx";
import { IconPurchaseOrder } from "../components/ui/AppIcons.jsx";
import "../components/MasterModalForm.css";
import "./OrdersPage.css";

export default function OrdersPage() {
  const auth = readAuth();
  const isRetailer = useMemo(() => isRetailerAuth(auth), [auth]);
  const canView = can("ORDERS", "VIEW") || can("PURCHASE_ORDERS", "VIEW");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [acceptNotes, setAcceptNotes] = useState("");
  const [overrides, setOverrides] = useState({});
  const [openPurchaseModal, setOpenPurchaseModal] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [actionBusyKey, setActionBusyKey] = useState(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);

  async function refresh() {
    if (!canView) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = isRetailer ? await listMyOrders({ status: status || undefined }) : await listIncomingOrders({ status: status || undefined });
    if (r.status >= 200 && r.status < 300 && r.json?.ok) setRows(r.json?.data?.items || []);
    else if (r.status !== 401) emitToast({ type: "error", message: parseApiError(r) });
    setLoading(false);
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRetailer, status, canView]);

  if (!canView) {
    return (
      <AppShell userName={auth?.user?.full_name || "User"} userEmail={auth?.user?.email || auth?.email || ""} userBusinessName={auth?.user?.firm_name || ""} userGstNumber={auth?.user?.gst_number || ""} variant="user">
        <div className="pageWrap">
          <div className="pageCard">
            <div className="raTitle">Orders</div>
            <div className="raSub">You don’t have permission to view marketplace orders.</div>
          </div>
        </div>
      </AppShell>
    );
  }
  async function openView(row) {
    setSelected(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const r = isRetailer ? await getOrderById(row.id) : await getWholesalerOrderView(row.id);
      if (r.status >= 200 && r.status < 300 && r.json?.ok) setDetail(r.json?.data || null);
      else {
        emitToast({ type: "error", message: parseApiError(r) });
        setSelected(null);
        setDetail(null);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function quickAction(type, row) {
    let r = null;
    const busyKey = `${type}:${row?.id || ""}`;
    setActionBusyKey(busyKey);
    try {
      if (type === "cancel") r = await cancelOrderRetailer(row.id, {});
      if (type === "dispatch") r = await dispatchOrder(row.id);
      if (type === "reject") r = await rejectOrder(row.id, { rejection_reason: rejectReason || "Rejected by wholesaler" });
      if (type === "confirm") r = await confirmDelivery(row.id);
      if (type === "purchase") {
        setSelected(row);
        setDetail(null);
        setDetailLoading(true);
        try {
          const dr = await getOrderById(row.id);
          if (dr.status >= 200 && dr.status < 300 && dr.json?.ok) {
            const lines = dr.json?.data?.items || [];
            setDetail(dr.json?.data || null);
            setPurchaseItems(lines.map((x) => ({ order_item_id: x.id, received_qty: Number(x.accepted_qty || x.ordered_qty || 0) })));
            setOpenPurchaseModal(true);
          } else {
            emitToast({ type: "error", message: parseApiError(dr) });
            setSelected(null);
            setDetail(null);
          }
        } finally {
          setDetailLoading(false);
        }
        return;
      }

      if (r && r.status >= 200 && r.status < 300 && r.json?.ok) {
        setSelected(null);
        setDetail(null);
        setRejectReason("");
        refresh();
        emitToast({ type: "success", message: "Updated." });
        return;
      }
      if (r) emitToast({ type: "error", message: parseApiError(r) });
    } finally {
      setActionBusyKey(null);
    }
  }

  function setOverride(itemId, key, value) {
    setOverrides((p) => ({ ...p, [itemId]: { ...(p[itemId] || {}), [key]: value } }));
  }

  async function onAcceptSubmit() {
    if (!selected?.id || !detail?.items?.length) return;
    if (acceptBusy) return;
    setAcceptBusy(true);
    const item_overrides = detail.items.map((it) => ({
      order_item_id: it.id,
      accepted_qty: Number(overrides[it.id]?.accepted_qty ?? it.ordered_qty),
      free_qty: Number(overrides[it.id]?.free_qty ?? it.free_qty ?? 0),
      batch_id: overrides[it.id]?.batch_id || undefined
    }));
    try {
      const r = await acceptOrder(selected.id, { wholesaler_notes: acceptNotes || null, item_overrides });
      if (r.status >= 200 && r.status < 300 && r.json?.ok) {
        emitToast({ type: "success", message: "Order accepted." });
        setAcceptNotes("");
        setOverrides({});
        setSelected(null);
        refresh();
        return;
      }
      emitToast({ type: "error", message: parseApiError(r) });
    } finally {
      setAcceptBusy(false);
    }
  }

  async function onCreatePurchaseWithAdjust() {
    if (!selected?.id) return;
    if (purchaseBusy) return;
    setPurchaseBusy(true);
    try {
      const r = await createPurchaseFromOrder(selected.id, { items: purchaseItems });
      if (r.status >= 200 && r.status < 300 && r.json?.ok) {
        setOpenPurchaseModal(false);
        setPurchaseItems([]);
        setSelected(null);
        refresh();
        emitToast({ type: "success", message: "Purchase invoice created." });
        return;
      }
      emitToast({ type: "error", message: parseApiError(r) });
    } finally {
      setPurchaseBusy(false);
    }
  }

  const columns = [
    { key: "order_number", label: "Order No", mobilePrimary: true },
    { key: isRetailer ? "wholesaler_firm_name" : "retailer_firm_name", label: isRetailer ? "Wholesaler" : "Retailer" },
    { key: "total_amount", label: "Amount", render: (v) => `₹${Number(v || 0).toFixed(2)}` },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      render: (_, r) => (
        <OrdersQuickActions
          isRetailer={isRetailer}
          row={r}
          onView={openView}
          onQuickAction={quickAction}
          rejectReason={rejectReason}
          busyKey={actionBusyKey}
        />
      )
    }
  ];

  return (
    <AppShell userName={auth?.user?.full_name || "User"} userEmail={auth?.user?.email || auth?.email || ""} userBusinessName={auth?.user?.firm_name || ""} userGstNumber={auth?.user?.gst_number || ""} variant="user">
      <div className="pageWrap ordersPage">
        <div className="raTop">
          <div>
            <div className="raTitle">{isRetailer ? "My Orders" : "Orders"}</div>
            <div className="raSub">{isRetailer ? "Track placed orders and confirm delivery." : "Manage incoming retailer orders."}</div>
          </div>
        </div>
        <div className="pageCard">
          <CommonTable
            title=""
            subtitle=""
            compact
            loading={loading}
            countText={loading ? "Loading..." : `${rows.length} orders`}
            filters={[
              {
                id: "status",
                label: "Status",
                value: status,
                onChange: setStatus,
                options: [{ value: "", label: "All status" }, ...["PENDING", "ACCEPTED", "REJECTED", "DISPATCHED", "DELIVERED", "CANCELLED"].map((s) => ({ value: s, label: s }))]
              }
            ]}
            rows={rows}
            getRowId={(r) => r.id}
            columns={columns.map((c) => ({
              id: c.key,
              header: c.label,
              align: c.key === "total_amount" ? "right" : undefined,
              mobilePrimary: c.mobilePrimary,
              mobilePriority: c.mobilePriority,
              render: (r) => (typeof c.render === "function" ? c.render(r[c.key], r) : r[c.key] ?? "-")
            }))}
          />
        </div>
      </div>

      <CommonModal
        open={Boolean(selected)}
        ariaLabel="orders-detail"
        onClose={() => {
          setSelected(null);
          setDetail(null);
          setDetailLoading(false);
        }}
        title={selected?.order_number || "Order details"}
        subtitle={
          selected
            ? isRetailer
              ? "Line items, totals, and delivery milestones."
              : "Review items and update this incoming order."
            : undefined
        }
        size="lg"
        icon={<IconPurchaseOrder />}
        loading={detailLoading}
        loadingText="Loading order…"
      >
        <div className="mfzGrid ordDetailGrid">
          <div className={`mfz12 ordDetailTopBand ${isRetailer ? "ordDetailTopBand--split" : ""}`}>
            <OrderDetailFacts detail={detail} isRetailer={isRetailer} />
            {isRetailer ? <OrderDetailFulfillment order={detail?.order} /> : null}
          </div>

          <div className="mfz12 ordSection">
            <CommonTable
              title=""
              subtitle=""
              compact
              columnPrefsKey="orders-detail-lines"
              loading={false}
              countText={detail?.items?.length ? `${detail.items.length} items` : "0 items"}
              rows={detail?.items || []}
              getRowId={(r) => r.id}
              columns={[
                { id: "product_name", header: "Product", mobilePrimary: true, render: (r) => r.product_name || "—" },
                { id: "packing", header: "Packing", render: (r) => r.packing || "—" },
                { id: "ordered_qty", header: "Ordered", align: "right", render: (r) => Number(r.ordered_qty || 0) },
                { id: "accepted_qty", header: "Accepted", align: "right", render: (r) => Number(r.accepted_qty || 0) },
                { id: "free_qty", header: "Free", align: "right", sortable: false, mobilePriority: 3, render: (r) => Number(r.free_qty || 0) },
                {
                  id: "batch_no",
                  header: "Batch",
                  sortable: false,
                  mobilePriority: 3,
                  render: (r) => r.batch_no || r.batchNo || (r.batch_id ? String(r.batch_id).slice(0, 8) : "—")
                },
                ...(isRetailer
                  ? []
                  : [{ id: "available_stock", header: "Available", align: "right", mobilePriority: 3, render: (r) => Number(r.available_stock || 0) }]),
                {
                  id: "unit_price",
                  header: "Rate",
                  align: "right",
                  sortable: false,
                  mobilePriority: 2,
                  render: (r) => {
                    const rate = r.unit_price ?? r.rate;
                    return rate == null ? "—" : `₹${Number(rate || 0).toFixed(2)}`;
                  }
                },
                { id: "line_total", header: "Total", align: "right", render: (r) => `₹${Number(r.line_total || 0).toFixed(2)}` }
              ]}
            />
          </div>
          {!isRetailer && detail?.order?.status === "PENDING" ? (
            <div className="mfz12 ordAcceptBox">
              <h4>Accept Order</h4>
              {(detail?.items || []).map((it) => (
                <div key={it.id} className="ordOverrideRow">
                  <div>{it.product_name}</div>
                  <input
                    className="mfzInput"
                    placeholder="Accepted qty"
                    value={overrides[it.id]?.accepted_qty ?? it.ordered_qty}
                    onChange={(e) => setOverride(it.id, "accepted_qty", e.target.value)}
                  />
                  <input className="mfzInput" placeholder="Free qty" value={overrides[it.id]?.free_qty ?? it.free_qty ?? 0} onChange={(e) => setOverride(it.id, "free_qty", e.target.value)} />
                  <input className="mfzInput" placeholder="Batch id (optional)" value={overrides[it.id]?.batch_id || ""} onChange={(e) => setOverride(it.id, "batch_id", e.target.value)} />
                </div>
              ))}
              <textarea className="mfzTextarea" placeholder="Wholesaler notes" value={acceptNotes} onChange={(e) => setAcceptNotes(e.target.value)} />
              <div className="ordActions">
                <input className="mfzInput" placeholder="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <AppButton
                  variant="danger"
                  onClick={() => quickAction("reject", selected)}
                  disabled={actionBusyKey === `reject:${selected?.id || ""}`}
                >
                  {actionBusyKey === `reject:${selected?.id || ""}` ? <InlineButtonProgress label="Rejecting…" /> : "Reject"}
                </AppButton>
                <AppButton onClick={onAcceptSubmit} disabled={acceptBusy}>
                  {acceptBusy ? <InlineButtonProgress label="Accepting…" /> : "Accept Order with Adjustments"}
                </AppButton>
              </div>
            </div>
          ) : null}
        </div>
      </CommonModal>

      <CommonModal
        open={openPurchaseModal}
        ariaLabel="orders-create-purchase"
        onClose={() => {
          setOpenPurchaseModal(false);
          setSelected(null);
        }}
        title="Add to Purchases"
      >
        <div className="mfzGrid ordPurchaseBody">
          {(detail?.items || []).map((it) => {
            const row = purchaseItems.find((x) => x.order_item_id === it.id) || { received_qty: 0 };
            return (
              <div key={it.id} className="ordOverrideRow">
                <div>{it.product_name}</div>
                <div>Accepted: {it.accepted_qty || it.ordered_qty}</div>
                <input
                  className="mfzInput"
                  value={row.received_qty}
                  onChange={(e) =>
                    setPurchaseItems((prev) =>
                      prev.map((p) => (p.order_item_id === it.id ? { ...p, received_qty: Number(e.target.value || 0) } : p))
                    )
                  }
                />
              </div>
            );
          })}
          <div className="ordActions">
            <AppButton variant="ghost" onClick={() => setOpenPurchaseModal(false)}>
              Cancel
            </AppButton>
            <AppButton onClick={onCreatePurchaseWithAdjust} disabled={purchaseBusy}>
              {purchaseBusy ? <InlineButtonProgress label="Creating…" /> : "Create Purchase Invoice"}
            </AppButton>
          </div>
        </div>
      </CommonModal>
    </AppShell>
  );
}

