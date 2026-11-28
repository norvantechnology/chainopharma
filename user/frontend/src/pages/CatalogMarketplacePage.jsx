import { AppButton } from "../components/ui/buttons.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import AppShell from "../layouts/AppShell.jsx";
import CommonTable from "../components/CommonTable.jsx";
import CommonModal from "../components/CommonModal.jsx";
import ModalFooterShell from "../components/ui/ModalFooterShell.jsx";
import { IconPlaceOrder } from "../components/ui/AppIcons.jsx";
import OrderPlaceWizardModal from "../components/orders/OrderPlaceWizardModal.jsx";
import OrderCatalogProductDetailsModal from "../components/orders/OrderCatalogProductDetailsModal.jsx";
import QtyStepper from "../components/ui/QtyStepper.jsx";
import { readAuth } from "../services/authStorage.js";
import { isRetailerAuth } from "../utils/businessRole.js";
import { emitToast } from "../services/toastBus.js";
import { parseApiError } from "../utils/api.js";
import { can } from "../utils/access.js";
import { listAcceptedWholesalers, listWholesalerProducts, placeOrder } from "../services/orderService.js";
import "./CatalogMarketplacePage.css";

function unitPriceOf(row) {
  return Number(row?.unit_price ?? row?.sales_rate ?? row?.catalog_price ?? 0);
}

export default function CatalogMarketplacePage() {
  const auth = readAuth();
  const isRetailer = useMemo(() => isRetailerAuth(auth), [auth]);
  const canView =
    can("ORDERS", "VIEW") || can("WHOLESALER_LINKS", "VIEW") || can("PURCHASE_ORDERS", "VIEW");

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [wholesalers, setWholesalers] = useState([]);
  const [wholesalerId, setWholesalerId] = useState("");
  const [openOrder, setOpenOrder] = useState(false);
  const [cartLines, setCartLines] = useState([]);
  const [cartWholesalerId, setCartWholesalerId] = useState("");
  const [openRetailerDetail, setOpenRetailerDetail] = useState(false);
  const [selectedRetailerRow, setSelectedRetailerRow] = useState(null);
  const [qtyPick, setQtyPick] = useState({ open: false, row: null });
  const [qtyPickValue, setQtyPickValue] = useState(1);

  const activeWholesaler = useMemo(
    () => wholesalers.find((w) => String(w.wholesaler_account_id || "") === String(wholesalerId || "")) || null,
    [wholesalers, wholesalerId]
  );

  async function refresh() {
    if (!canView || !isRetailer) {
      setRows([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const wr = await listAcceptedWholesalers({ limit: 200 });
    let items = [];
    if (wr.status >= 200 && wr.status < 300 && wr.json?.ok) {
      items = (wr.json?.data?.items || []).map((w) => ({
        wholesaler_account_id: w.wholesaler_account_id,
        wholesaler_name: w.wholesaler_name,
        discount_percent: w.discount_percent,
        link_id: w.link_id,
        link_status: w.status || "ACTIVE"
      }));
    }
    setWholesalers(items);
    if (!items.length) {
      setWholesalerId("");
      setRows([]);
      setBusy(false);
      return;
    }
    const nextWh =
      items.some((w) => String(w.wholesaler_account_id) === String(wholesalerId))
        ? wholesalerId
        : items[0]?.wholesaler_account_id || "";
    if (String(nextWh) !== String(wholesalerId)) {
      setWholesalerId(nextWh);
      setBusy(false);
      return;
    }
    const br = await listWholesalerProducts(nextWh, { search: search || undefined, limit: 200 });
    if (br.status >= 200 && br.status < 300 && br.json?.ok) {
      const products = (br.json?.data?.items || []).map((p) => ({
        ...p,
        id: p.product_id || p.id,
        product_id: p.product_id || p.id,
        unit_price: unitPriceOf(p),
        sales_rate: unitPriceOf(p),
        retailer_discount_percent: Number(
          br.json?.data?.link?.discount_percent ?? p.retailer_discount_percent ?? 0
        )
      }));
      setRows(products);
    } else if (br.status !== 401) {
      emitToast({ type: "error", message: parseApiError(br) });
      setRows([]);
    }
    setBusy(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, isRetailer, wholesalerId, search]);

  const qtyByProductId = useMemo(() => {
    const m = new Map();
    for (const ln of cartLines) {
      if (String(ln.wholesalerAccountId || "") !== String(wholesalerId || "")) continue;
      m.set(String(ln.row?.id || ""), Number(ln.qty || 0));
    }
    return m;
  }, [cartLines, wholesalerId]);

  const cartCount = useMemo(
    () =>
      cartLines.filter((ln) => String(ln.wholesalerAccountId || "") === String(wholesalerId || "")).length,
    [cartLines, wholesalerId]
  );

  function setCartQty(row, qty) {
    const id = String(row.id || "");
    const min = Math.max(1, Number(row.min_order_qty || 1) || 1);
    const nextQty = Math.max(min, Number(qty || min) || min);
    setCartWholesalerId(String(wholesalerId || ""));
    setCartLines((prev) => {
      const others = (prev || []).filter(
        (ln) =>
          !(
            String(ln.wholesalerAccountId || "") === String(wholesalerId || "") &&
            String(ln.row?.id || "") === id
          )
      );
      return [...others, { row, qty: nextQty, wholesalerAccountId: String(wholesalerId || "") }];
    });
  }

  function removeFromCart(productId) {
    const id = String(productId || "");
    setCartLines((prev) =>
      (prev || []).filter(
        (ln) =>
          !(
            String(ln.wholesalerAccountId || "") === String(wholesalerId || "") &&
            String(ln.row?.id || "") === id
          )
      )
    );
  }

  function openQtyPicker(row) {
    const min = Math.max(1, Number(row?.min_order_qty || 1) || 1);
    const existing = qtyByProductId.get(String(row.id));
    setQtyPick({ open: true, row });
    setQtyPickValue(existing && existing > 0 ? existing : min);
  }

  function openCart() {
    if (!cartCount) {
      emitToast({ type: "error", message: "Cart is empty. Add products first." });
      return;
    }
    setCartWholesalerId(String(wholesalerId || ""));
    setOpenOrder(true);
  }

  if (!isRetailer) {
    return <Navigate to="/quality-master" replace />;
  }

  if (!canView) {
    return (
      <AppShell
        userName={auth?.user?.full_name || "User"}
        userEmail={auth?.user?.email || auth?.email || ""}
        userBusinessName={auth?.user?.firm_name || ""}
        userGstNumber={auth?.user?.gst_number || ""}
        variant="user"
      >
        <div className="pageWrap">
          <div className="raTop">
            <div>
              <div className="raTitle">Order Products</div>
              <div className="raSub">You don’t have permission to view wholesaler products.</div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const columns = [
    {
      id: "product_info",
      header: "Product",
      render: (r) => (
        <div className="cmpProdCell">
          <div className="cmpProdMain">{r.product_name || "-"}</div>
          <div className="cmpProdSub">
            {[r.product_code ? `Code: ${r.product_code}` : "", r.drug_name ? `Drug: ${r.drug_name}` : ""]
              .filter(Boolean)
              .join(" · ")}
            {r.sales_gst != null && r.sales_gst !== "" ? ` · GST: ${r.sales_gst}%` : ""}
          </div>
        </div>
      )
    },
    { id: "packing", header: "Packing", mobilePriority: 2, render: (r) => r.packing || "-" },
    {
      id: "unit_price",
      header: "Rate",
      align: "right",
      mobilePriority: 2,
      render: (r) => `₹${unitPriceOf(r).toFixed(2)}`
    },
    {
      id: "qty",
      header: "Qty",
      align: "center",
      mobilePriority: 2,
      sortable: false,
      render: (r) => {
        const id = String(r.id || "");
        const min = Math.max(1, Number(r.min_order_qty || 1) || 1);
        const rawMax = r.max_order_qty == null || r.max_order_qty === "" ? null : Number(r.max_order_qty || 0);
        const max = rawMax != null && rawMax > 0 ? rawMax : null;
        const v = qtyByProductId.get(id) || 0;
        if (!v) return <span style={{ color: "var(--color-text-4)", fontWeight: 800 }} />;
        return (
          <div className="cmpQtyStepperWrap" onClick={(e) => e.stopPropagation()}>
            <QtyStepper
              size="sm"
              value={v}
              min={min}
              max={max}
              onChange={(next) => {
                if (next <= 0) removeFromCart(id);
                else setCartQty(r, next);
              }}
            />
          </div>
        );
      }
    },
    {
      id: "current_stock",
      header: "Stock",
      align: "right",
      mobilePriority: 3,
      render: (r) => Number(r.current_stock || 0).toFixed(0)
    },
    {
      id: "actions",
      header: "Order",
      align: "center",
      mobilePriority: 1,
      render: (r) => (
        <AppButton
          size="sm"
          variant="secondary"
          iconOnly
          aria-label="Place order"
          icon={<IconPlaceOrder />}
          title="Place order"
          className="cmpOrderRowAction"
          onClick={(e) => {
            e.stopPropagation();
            openQtyPicker(r);
          }}
        />
      )
    }
  ];

  return (
    <AppShell
      userName={auth?.user?.full_name || "User"}
      userEmail={auth?.user?.email || auth?.email || ""}
      userBusinessName={auth?.user?.firm_name || ""}
      userGstNumber={auth?.user?.gst_number || ""}
      variant="user"
    >
      <div className="pageWrap">
        <div className="raTop">
          <div>
            <div className="raTitle">Order Products</div>
          </div>
        </div>
        {!busy && !wholesalers.length ? (
          <div className="pageCard" style={{ marginBottom: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No accepted wholesalers yet</div>
            <div style={{ color: "var(--color-text-3)", marginBottom: 12 }}>
              Send a match request and wait for the wholesaler to accept before placing orders.
            </div>
            <Link
              to="/wholesaler-links"
              className="appBtn appBtn--primary"
              style={{ textDecoration: "none", display: "inline-flex" }}
            >
              Go to Wholesalers
            </Link>
          </div>
        ) : null}
        <div className="pageCard">
          <CommonTable
            title=""
            subtitle=""
            compact
            loading={busy}
            countText={busy ? "Loading..." : `${rows.length} items`}
            search={search}
            onSearchChange={setSearch}
            filters={[
              {
                id: "wholesaler",
                label: "Wholesaler",
                value: wholesalerId,
                onChange: setWholesalerId,
                options: [
                  { value: "", label: "Select wholesaler" },
                  ...wholesalers.map((w) => ({
                    value: w.wholesaler_account_id,
                    label: w.wholesaler_name
                  }))
                ]
              }
            ]}
            extraHeaderActions={
              <AppButton
                variant="secondary"
                onClick={openCart}
                disabled={!cartCount}
                icon={<IconPlaceOrder />}
              >
                Cart {cartCount ? `(${cartCount})` : ""}
              </AppButton>
            }
            rows={rows}
            getRowId={(r) => r.id}
            columns={columns}
            onRowClick={(row) => {
              setSelectedRetailerRow(row);
              setOpenRetailerDetail(true);
            }}
          />
        </div>
      </div>

      <CommonModal
        open={qtyPick.open}
        onClose={() => setQtyPick({ open: false, row: null })}
        title="Select quantity"
        footer={
          <ModalFooterShell variant="appActions">
            <AppButton variant="secondary" type="button" onClick={() => setQtyPick({ open: false, row: null })}>
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              type="button"
              onClick={() => {
                if (qtyPick.row) setCartQty(qtyPick.row, qtyPickValue);
                setQtyPick({ open: false, row: null });
              }}
            >
              Add to cart
            </AppButton>
          </ModalFooterShell>
        }
      >
        <div className="cmpCatalogQtyPick">
          <p className="cmpCatalogQtyPickProduct">{qtyPick.row?.product_name || "Product"}</p>
          <div className="cmpCatalogQtyPickStepper">
            <QtyStepper
              value={qtyPickValue}
              min={Math.max(1, Number(qtyPick.row?.min_order_qty || 1) || 1)}
              max={
                qtyPick.row?.max_order_qty == null || qtyPick.row?.max_order_qty === ""
                  ? null
                  : Number(qtyPick.row.max_order_qty)
              }
              onChange={setQtyPickValue}
            />
          </div>
          <p className="cmpCatalogQtyPickLimits">
            Rate ₹{unitPriceOf(qtyPick.row).toFixed(2)}
            {qtyPick.row?.packing ? ` · ${qtyPick.row.packing}` : ""}
          </p>
        </div>
      </CommonModal>

      <OrderCatalogProductDetailsModal
        open={openRetailerDetail}
        onClose={() => setOpenRetailerDetail(false)}
        row={selectedRetailerRow}
        wholesalerName={activeWholesaler?.wholesaler_name}
      />

      <OrderPlaceWizardModal
        open={openOrder}
        onClose={() => setOpenOrder(false)}
        mode="cart"
        wholesalerAccountId={cartWholesalerId || wholesalerId}
        wholesalerName={activeWholesaler?.wholesaler_name}
        cartItems={cartLines.filter(
          (ln) => String(ln.wholesalerAccountId || "") === String(cartWholesalerId || wholesalerId || "")
        )}
        onPlaceOrder={async (payload) => {
          const r = await placeOrder(payload);
          if (r?.status >= 200 && r?.status < 300 && r?.json?.ok) {
            setCartLines((prev) =>
              (prev || []).filter(
                (ln) =>
                  String(ln.wholesalerAccountId || "") !==
                  String(payload.wholesaler_account_id || cartWholesalerId || "")
              )
            );
          }
          return r;
        }}
      />
    </AppShell>
  );
}
