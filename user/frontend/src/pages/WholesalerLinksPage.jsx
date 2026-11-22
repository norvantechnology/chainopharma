import { AppButton, InlineButtonProgress } from "../components/ui/buttons.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../layouts/AppShell.jsx";
import CommonTable from "../components/CommonTable.jsx";
import { readAuth } from "../services/authStorage.js";
import { isRetailerAuth } from "../utils/businessRole.js";
import { emitToast } from "../services/toastBus.js";
import { parseApiError } from "../utils/api.js";
import { can } from "../utils/access.js";
import {
  acceptMatchRequest,
  listActiveWholesalers,
  listIncomingMatchRequests,
  listMyWholesalerLinks,
  rejectMatchRequest,
  requestWholesalerLink
} from "../services/orderService.js";
import "./OrdersPage.css";

export default function WholesalerLinksPage() {
  const auth = readAuth();
  const isRetailer = useMemo(() => isRetailerAuth(auth), [auth]);
  const canView = can("WHOLESALER_LINKS", "VIEW");
  const canAddLink = can("WHOLESALER_LINKS", "ADD");
  const canDecide = can("WHOLESALER_LINKS", "UPDATE");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      if (isRetailer) {
        const [active, mine] = await Promise.all([
          listActiveWholesalers({ search: search || undefined, limit: 200 }),
          listMyWholesalerLinks()
        ]);
        const linksByWh = new Map();
        if (mine.status >= 200 && mine.status < 300 && mine.json?.ok) {
          for (const l of mine.json?.data?.items || []) {
            linksByWh.set(String(l.wholesaler_account_id), l);
          }
        }
        if (active.status >= 200 && active.status < 300 && active.json?.ok) {
          const items = (active.json?.data?.items || []).map((w) => {
            const link = linksByWh.get(String(w.wholesaler_account_id)) || null;
            return {
              ...w,
              link_id: w.link_id || link?.id || null,
              link_status: w.link_status || link?.status || null
            };
          });
          setRows(items);
        } else if (active.status !== 401) {
          emitToast({ type: "error", message: parseApiError(active) });
          setRows([]);
        }
      } else {
        const r = await listIncomingMatchRequests({ status: "PENDING", limit: 200 });
        if (r.status >= 200 && r.status < 300 && r.json?.ok) setRows(r.json?.data?.items || []);
        else if (r.status !== 401) {
          emitToast({ type: "error", message: parseApiError(r) });
          setRows([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRetailer, search, canView]);

  if (!canView) {
    return (
      <AppShell userName={auth?.user?.full_name || "User"} userEmail={auth?.user?.email || auth?.email || ""} userBusinessName={auth?.user?.firm_name || ""} userGstNumber={auth?.user?.gst_number || ""} variant="user">
        <div className="pageWrap">
          <div className="pageCard">
            <div className="raTitle">{isRetailer ? "Wholesalers" : "Match Requests"}</div>
            <div className="raSub">You don’t have permission to view wholesaler links.</div>
          </div>
        </div>
      </AppShell>
    );
  }

  async function onSendRequest(row) {
    const id = String(row.wholesaler_account_id || "");
    if (!id || busyId) return;
    setBusyId(`req:${id}`);
    try {
      const r = await requestWholesalerLink({
        wholesaler_account_id: id,
        request_message: "Please connect so we can place orders."
      });
      if (r.status >= 200 && r.status < 300 && r.json?.ok) {
        emitToast({ type: "success", message: "Match request sent." });
        refresh();
        return;
      }
      emitToast({ type: "error", message: parseApiError(r) });
    } finally {
      setBusyId("");
    }
  }

  async function onAccept(row) {
    const id = String(row.id || "");
    if (!id || busyId) return;
    setBusyId(`accept:${id}`);
    try {
      const r = await acceptMatchRequest(id, {});
      if (r.status >= 200 && r.status < 300 && r.json?.ok) {
        emitToast({ type: "success", message: "Match request accepted." });
        refresh();
        return;
      }
      emitToast({ type: "error", message: parseApiError(r) });
    } finally {
      setBusyId("");
    }
  }

  async function onReject(row) {
    const id = String(row.id || "");
    if (!id || busyId) return;
    setBusyId(`reject:${id}`);
    try {
      const r = await rejectMatchRequest(id, {
        rejection_reason: rejectReason || "Rejected by wholesaler"
      });
      if (r.status >= 200 && r.status < 300 && r.json?.ok) {
        emitToast({ type: "success", message: "Match request rejected." });
        setRejectReason("");
        refresh();
        return;
      }
      emitToast({ type: "error", message: parseApiError(r) });
    } finally {
      setBusyId("");
    }
  }

  const retailerColumns = [
    { id: "wholesaler_name", header: "Wholesaler", mobilePrimary: true, render: (r) => r.wholesaler_name || "—" },
    { id: "city", header: "City", render: (r) => r.city || "—" },
    { id: "state", header: "State", render: (r) => r.state || "—" },
    {
      id: "link_status",
      header: "Status",
      render: (r) => r.link_status || "NOT CONNECTED"
    },
    {
      id: "actions",
      header: "Action",
      render: (r) => {
        const st = String(r.link_status || "").toUpperCase();
        if (st === "ACTIVE") {
          return (
            <Link to="/order-products" style={{ fontWeight: 700 }}>
              Order products
            </Link>
          );
        }
        if (st === "PENDING") return <span style={{ color: "var(--color-text-3)" }}>Pending…</span>;
        if (st === "BLOCKED") return <span style={{ color: "var(--color-danger, #b91c1c)" }}>Blocked</span>;
        const canSend = canAddLink && (!st || st === "REJECTED");
        return canSend ? (
          <AppButton
            size="sm"
            onClick={() => onSendRequest(r)}
            disabled={busyId === `req:${r.wholesaler_account_id}`}
          >
            {busyId === `req:${r.wholesaler_account_id}` ? <InlineButtonProgress label="Sending…" /> : "Send request"}
          </AppButton>
        ) : (
          "—"
        );
      }
    }
  ];

  const wholesalerColumns = [
    { id: "retailer_name", header: "Retailer", mobilePrimary: true, render: (r) => r.retailer_name || "—" },
    { id: "retailer_city", header: "City", render: (r) => r.retailer_city || "—" },
    { id: "retailer_state", header: "State", render: (r) => r.retailer_state || "—" },
    {
      id: "request_message",
      header: "Message",
      render: (r) => r.request_message || "—"
    },
    {
      id: "actions",
      header: "Action",
      render: (r) =>
        canDecide ? (
          <div className="ordQuickActions">
            <AppButton size="sm" onClick={() => onAccept(r)} disabled={busyId === `accept:${r.id}`}>
              {busyId === `accept:${r.id}` ? <InlineButtonProgress /> : "Accept"}
            </AppButton>
            <AppButton size="sm" variant="danger" onClick={() => onReject(r)} disabled={busyId === `reject:${r.id}`}>
              {busyId === `reject:${r.id}` ? <InlineButtonProgress /> : "Reject"}
            </AppButton>
          </div>
        ) : (
          <span style={{ color: "var(--color-text-3)" }}>View only</span>
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
      <div className="pageWrap ordersPage">
        <div className="raTop">
          <div>
            <div className="raTitle">{isRetailer ? "Wholesalers" : "Match Requests"}</div>
            <div className="raSub">
              {isRetailer
                ? "Find wholesalers and send a match request. After acceptance you can place orders."
                : "Accept or reject retailer connection requests."}
            </div>
          </div>
        </div>
        {!isRetailer && canDecide ? (
          <div className="wlRejectReason">
            <input
              className="mfzInput"
              placeholder="Default rejection reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
        ) : null}
        <div className="pageCard">
          <CommonTable
            title=""
            subtitle=""
            compact
            loading={loading}
            countText={loading ? "Loading..." : `${rows.length} ${isRetailer ? "wholesalers" : "requests"}`}
            emptyTitle={isRetailer ? "No wholesalers found" : "No pending match requests"}
            emptyMessage={
              isRetailer
                ? "Try a different search, or check back later for new wholesalers."
                : "When retailers send a connection request, it will show up here."
            }
            filters={
              isRetailer
                ? [
                    {
                      id: "search",
                      label: "Search",
                      value: search,
                      onChange: setSearch,
                      placeholder: "Search wholesaler…"
                    }
                  ]
                : []
            }
            rows={rows}
            getRowId={(r) => r.wholesaler_account_id || r.id}
            columns={isRetailer ? retailerColumns : wholesalerColumns}
          />
        </div>
      </div>
    </AppShell>
  );
}
