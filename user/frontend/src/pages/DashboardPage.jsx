import { useEffect, useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import AppShell from "../layouts/AppShell.jsx";
import { readAuth, onAuthChanged } from "../services/authStorage.js";
import { isRetailerAuth } from "../utils/businessRole.js";
import { NAV_LABELS } from "../constants/navLabels.js";
import "../components/StructuredForm.css";
import "./DashboardPage.css";
import "../components/charts/charts.css";
import { todayYmdLocal } from "../utils/date.js";
import { daysUntil, fmtMoneyINR, ymd } from "../utils/format.js";
import CommonDatePicker from "../components/CommonDatePicker.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { getDashboardSummary } from "../services/dashboardService.js";
import { parseApiError } from "../utils/api.js";
import { emitToast } from "../services/toastBus.js";
import LineAreaChart from "../components/charts/LineAreaChart.jsx";
import BarChart from "../components/charts/BarChart.jsx";
import DonutChart from "../components/charts/DonutChart.jsx";
import {
  IconAlert,
  IconChevronsDown,
  IconChevronsUp,
  IconCustomerMark,
  IconDashZap,
  IconDayBook,
  IconLinkOut,
  IconNearExpiry,
  IconNonMoving,
  IconPayment,
  IconPlus,
  IconPurchaseOrder,
  IconSalesRegister,
  IconSalesReturn,
  IconStockAlert,
  IconWallet,
} from "../components/ui/AppIcons.jsx";

function statusPillClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "CONFIRMED" || s === "PAID") return "green";
  if (s === "DRAFT") return "gray";
  if (s === "CANCELLED" || s === "UNPAID") return "red";
  if (s === "PARTIAL") return "amber";
  return "gray";
}

function quarterStartYmd(ymdStr) {
  const s = String(ymdStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return "";
  const qm = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(qm).padStart(2, "0")}-01`;
}

export default function DashboardPage() {
  const auth = readAuth();
  const user = auth?.user || null;
  const isRetailer = isRetailerAuth(auth);
  const [, bumpAuth] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(todayYmdLocal());
  const [preset, setPreset] = useState("MONTH");
  const [summary, setSummary] = useState(null);
  const [recentTab, setRecentTab] = useState("SALES");
  const [search, setSearch] = useState("");
  const [animBars, setAnimBars] = useState(false);
  const navigate = useNavigate();
  const [, setRefreshNonce] = useState(0);
  const [trendChartType, setTrendChartType] = useState("LINE");
  const [weekChartType, setWeekChartType] = useState("BAR");
  const [payChartType, setPayChartType] = useState("DONUT");
  const [filterOpen, setFilterOpen] = useState(false);
  const searchRef = useRef(null);
  const loadSeqRef = useRef(0);
  useEffect(() => onAuthChanged(() => bumpAuth((n) => n + 1)), []);
  const visibility = summary?.meta?.visibility || {};
  const canSales = !!visibility.sales;
  const canPurchases = !!visibility.purchases;
  const canBatches = !!visibility.batches;
  const canReturns = !!visibility.returns;
  const quickActions = useMemo(
      () => ({
        NEW_BILL: {
          title: "New Bill",
          subtitle: "Create a new sales bill quickly.",
          path: "/sales-billing?new=1",
          canOpen: !!canSales,
        },
        NEW_PURCHASE: {
          title: "New Purchase",
          subtitle: "Create a new purchase invoice quickly.",
          path: "/purchase-invoices?new=1",
          canOpen: !!canPurchases,
        },
        SALES_RETURN: {
          title: "Sales Return",
          subtitle: "Create a new sales return entry.",
          path: "/sales-returns?new=1",
          canOpen: !!canReturns,
        },
        RECORD_PAYMENT: {
          title: "Record Payment",
          subtitle: isRetailer ? "Record supplier payment." : "Record customer payment.",
          path: isRetailer ? "/division-payments?new=1" : "/customer-payments?new=1",
          canOpen: true,
        },
      }),
      [isRetailer, canSales, canPurchases, canReturns],
    );
  function runQuickAction(kind) {
    const action = quickActions[kind];
    if (!action?.canOpen) {
      emitToast({
        type: "warning",
        message: "You do not have permission for this action.",
      });
      return;
    }
    action?.path && navigate(action.path);
  }
  function onQuickKeyDown(ev, kind) {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    ev.stopPropagation();
    runQuickAction(kind);
  }
  function applyPreset(key) {
    setPreset(key);
    const today = todayYmdLocal();
    setDateTo(today);
    const from =
      {
        TODAY: today,
        MONTH: `${today.slice(0, 8)}01`,
        YEAR: `${today.slice(0, 4)}-04-01`,
        QUARTER: quarterStartYmd(today),
      }[key] || "";
    setDateFrom(from);
    loadSummary(from, today);
  }
  async function loadSummary(from, to) {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setAnimBars(false);
    const res = await getDashboardSummary({ dateFrom: from || undefined, dateTo: to || undefined });
    if (seq === loadSeqRef.current) {
      if (res.status >= 200 && res.status < 300 && res.json?.ok) {
        setSummary(res.json?.data || null);
      } else if (res.status !== 401) {
        emitToast({ type: "error", message: parseApiError(res) });
      }
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!dateFrom && preset === "MONTH") applyPreset("MONTH");
  }, []);

  useEffect(() => {
    const from = String(dateFrom || "").trim();
    const to = String(dateTo || "").trim();
    if (!from || !to) return;
    const t = setTimeout(() => {
      setRefreshNonce((n) => n + 1);
      loadSummary(from, to);
    }, 450);
    return () => clearTimeout(t);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    function onKey(ev) {
      if (ev.key === "/" && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        const tag = String(document.activeElement?.tagName || "").toLowerCase();
        if (!["input", "textarea", "select"].includes(tag)) {
          ev.preventDefault();
          searchRef.current?.focus?.();
        }
      }
      if (ev.key === "Escape" && String(search || "").trim()) {
        ev.preventDefault();
        setSearch("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [search]);

  useEffect(() => {
    if (!summary) return;
    const t = setTimeout(() => setAnimBars(true), 250);
    return () => clearTimeout(t);
  }, [summary]);

  const paymentModes = useMemo(() => {
      const se = Array.isArray(summary?.widgets?.payment_modes)
        ? summary.widgets.payment_modes
        : [];
      return {
        total: se.reduce((Le, Ge) => Le + Number(Ge.total || 0), 0),
        rows: se.map((Le) => ({
          mode: String(Le.mode || "CASH"),
          total: Number(Le.total || 0),
        })),
      };
    }, [summary]);

  const salesWeek = useMemo(() => {
      const se = Array.isArray(summary?.widgets?.sales_week_7d)
        ? summary.widgets.sales_week_7d
        : [];
      return {
        rows: se,
        max: Math.max(1, ...se.map((H) => Number(H.sales_total || 0))),
      };
    }, [summary]);

  const topProducts = useMemo(() => {
      const se = Array.isArray(summary?.widgets?.top_products)
        ? summary.widgets.top_products
        : [];
      return {
        rows: se,
        max: Math.max(1, ...se.map((H) => Number(H.total || 0))),
      };
    }, [summary]);

  const trends = useMemo(() => {
      const se = Array.isArray(summary?.widgets?.sales_trend_30d)
          ? summary.widgets.sales_trend_30d
          : [],
        H = Array.isArray(summary?.widgets?.purchase_trend_30d)
          ? summary.widgets.purchase_trend_30d
          : [],
        Le = Math.max(
          1,
          ...se.map((Ge) => Number(Ge.sales_total || 0)),
          ...H.map((Ge) => Number(Ge.purchase_total || 0)),
        );
      return { sales: se, pur: H, max: Le };
    }, [summary]);

  const searchLower = String(search || "").trim().toLowerCase();
  const matchesSearch = (val) =>
    String(val || "").toLowerCase().includes(searchLower);

  const filteredProducts = useMemo(
    () =>
      searchLower
        ? topProducts.rows.filter((row) => matchesSearch(row.product_name))
        : topProducts.rows,
    [topProducts.rows, searchLower],
  );

  const filteredCustomers = useMemo(() => {
    const rows = Array.isArray(summary?.widgets?.top_customers)
      ? summary.widgets.top_customers
      : [];
    return searchLower ? rows.filter((row) => matchesSearch(row.customer_name)) : rows;
  }, [summary, searchLower]);

  const filteredRecent = useMemo(() => {
      const se =
        recentTab === "SALES"
          ? summary?.widgets?.recent_sales || []
          : recentTab === "PURCHASES"
            ? summary?.widgets?.recent_purchases || []
            : summary?.widgets?.recent_returns || [];
      return searchLower
        ? se.filter(
            (row) =>
              matchesSearch(row.invoice_number) ||
              matchesSearch(row.return_number) ||
              matchesSearch(row.customer_name) ||
              matchesSearch(row.vendor_name) ||
              matchesSearch(row.party_name),
          )
        : se;
    }, [summary, recentTab, searchLower]);

  const payModeColor = (mode) => {
    const m = String(mode || "").toUpperCase();
    return m === "UPI"
        ? "var(--color-success)"
      : m === "CARD"
        ? "var(--color-warning-strong)"
        : m === "CREDIT"
          ? "var(--color-secondary)"
          : "var(--color-primary)";
  };

  const prodBarColors = [
      "var(--color-primary)",
      "var(--color-success)",
      "var(--color-warning-strong)",
      "var(--color-secondary)",
      "var(--color-success-strong)",
    ];

  const trendCharts = useMemo(() => {
      const se = Array.isArray(trends?.sales) ? trends.sales : [],
        H = Array.isArray(trends?.pur) ? trends.pur : [],
        Le = Math.max(se.length, H.length, 0),
        Ge = Array.from({ length: Le }).map((mt, ne) => {
          const ve = se[ne]?.day || H[ne]?.day || "";
          return ve ? ymd(ve) : `#${ne + 1}`;
        });
      return {
        lineSeries: [
          {
            id: "sales",
            label: "Sales",
            color: "var(--color-primary)",
            values: Ge.map((mt, ne) => ({
              xLabel: mt,
              y: Number(se[ne]?.sales_total || 0),
            })),
          },
          {
            id: "purchase",
            label: "Purchase",
            color: "var(--color-warning-strong)",
            values: Ge.map((mt, ne) => ({
              xLabel: mt,
              y: Number(H[ne]?.purchase_total || 0),
            })),
          },
        ],
        barGroups: Ge.map((mt, ne) => ({
          xLabel: mt,
          series: [
            {
              id: "sales",
              label: "Sales",
              color: "var(--color-primary)",
              y: Number(se[ne]?.sales_total || 0),
            },
            {
              id: "purchase",
              label: "Purchase",
              color: "var(--color-warning-strong)",
              y: Number(H[ne]?.purchase_total || 0),
            },
          ],
        })),
      };
    }, [trends]);
  return jsx(AppShell, {
    userName: user?.full_name || "User",
    userEmail: user?.email || auth?.email || "",
    userBusinessName: user?.firm_name || "",
    userGstNumber: user?.gst_number || "",
    variant: "user",
    children: jsx("div", {
      className: "pageWrap pageWrapDash",
      children: jsxs("div", {
        className: "dashRoot",
        children: [
          jsxs("div", {
            className: "dash-ticker",
            role: "marquee",
            "aria-label": "Alerts ticker",
            children: [
              jsxs("div", {
                className: "ticker-label",
                children: [
                  jsx(IconAlert, {}),
                  jsx("span", { children: "Alerts" }),
                ],
              }),
              jsx("div", {
                className: "dash-ticker-track",
                children: jsx("div", {
                  className: "dash-ticker-inner",
                  children: [
                    {
                      label: "Near Expiry",
                      val: summary?.alerts?.near_expiry_batches ?? 0,
                      unit: "batches",
                      icon: jsx(IconNearExpiry, {}),
                    },
                    {
                      label: "Non‑Moving Stock",
                      val: summary?.alerts?.non_moving_items ?? 0,
                      unit: "items",
                      icon: jsx(IconNonMoving, {}),
                    },
                    {
                      label: "Receivables",
                      val: fmtMoneyINR(summary?.kpis?.receivables?.value || 0) || "₹0",
                      unit: "pending",
                      icon: jsx(IconWallet, { "aria-hidden": "true" }),
                    },
                    {
                      label: "Low Stock",
                      val: summary?.alerts?.low_stock_products ?? 0,
                      unit: "products",
                      icon: jsx(IconStockAlert, {}),
                    },
                    {
                      label: "Overdue Payables",
                      val: summary?.alerts?.overdue_payables_invoices ?? 0,
                      unit: "invoices",
                      icon: jsx(IconPurchaseOrder, {}),
                    },
                    {
                      label: "Near Expiry",
                      val: summary?.alerts?.near_expiry_batches ?? 0,
                      unit: "batches",
                      icon: jsx(IconNearExpiry, {}),
                    },
                    {
                      label: "Non‑Moving Stock",
                      val: summary?.alerts?.non_moving_items ?? 0,
                      unit: "items",
                      icon: jsx(IconNonMoving, {}),
                    },
                    {
                      label: "Receivables",
                      val: fmtMoneyINR(summary?.kpis?.receivables?.value || 0) || "₹0",
                      unit: "pending",
                      icon: jsx(IconWallet, { "aria-hidden": "true" }),
                    },
                    {
                      label: "Low Stock",
                      val: summary?.alerts?.low_stock_products ?? 0,
                      unit: "products",
                      icon: jsx(IconStockAlert, {}),
                    },
                    {
                      label: "Overdue Payables",
                      val: summary?.alerts?.overdue_payables_invoices ?? 0,
                      unit: "invoices",
                      icon: jsx(IconPurchaseOrder, {}),
                    },
                  ].map(({ label: se, val: H, unit: Le, icon: Ge }, mt) =>
                    jsxs(
                      "div",
                      {
                        className: "ticker-chip",
                        children: [
                          jsx("span", {
                            className: "ticker-chip-icon",
                            children: Ge,
                          }),
                          jsx("span", {
                            className: "ticker-chip-label",
                            children: se,
                          }),
                          jsxs("span", {
                            className: "ticker-chip-val",
                            children: [H, " ", Le],
                          }),
                        ],
                      },
                      mt,
                    ),
                  ),
                }),
              }),
            ],
          }),
          jsxs("div", {
            className: "dash-body",
            children: [
              jsxs("header", {
                className: "dash-header",
                children: [
                  jsx("div", {
                    className: "dash-header-left",
                    children: jsx("h1", {
                      className: "dash-page-title",
                      children: NAV_LABELS.dashboard,
                    }),
                  }),
                  jsx("div", {
                    className: "dash-header-center",
                    children: jsxs("div", {
                      className: "dash-search-wrap",
                      children: [
                        jsx(Search, {
                          "aria-hidden": "true",
                          size: 15,
                          strokeWidth: 2.4,
                        }),
                        jsx("input", {
                          ref: searchRef,
                          value: search,
                          onChange: (se) => setSearch(se.target.value),
                          placeholder: "Search… press /",
                          "aria-label": "Search dashboard",
                          className: "dash-search-input",
                        }),
                        search &&
                          jsx("button", {
                            className: "dash-search-clear",
                            onClick: () => setSearch(""),
                            "aria-label": "Clear search",
                            children: "✕",
                          }),
                      ],
                    }),
                  }),
                  jsxs("div", {
                    className: "dash-header-right",
                    children: [
                      jsx("div", {
                        className: "preset-tabs",
                        role: "group",
                        "aria-label": "Date presets",
                        children: [
                          { label: "Today", key: "TODAY" },
                          { label: "Month", key: "MONTH" },
                          { label: "Quarter", key: "QUARTER" },
                          { label: "Year", key: "YEAR" },
                        ].map(({ label, key }) =>
                          jsx(
                            "button",
                            {
                              className: `preset-tab ${preset === key ? "active" : ""}`,
                              onClick: () => applyPreset(key),
                              children: label,
                            },
                            key,
                          ),
                        ),
                      }),
                      jsxs("button", {
                        className: "filter-toggle-btn",
                        onClick: () => setFilterOpen((v) => !v),
                        "aria-expanded": filterOpen,
                        "aria-label": "Toggle date filter",
                        children: [
                          jsxs("svg", {
                            width: "14",
                            height: "14",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "2.5",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            children: [
                              jsx("line", {
                                x1: "4",
                                y1: "6",
                                x2: "20",
                                y2: "6",
                              }),
                              jsx("line", {
                                x1: "8",
                                y1: "12",
                                x2: "16",
                                y2: "12",
                              }),
                              jsx("line", {
                                x1: "11",
                                y1: "18",
                                x2: "13",
                                y2: "18",
                              }),
                            ],
                          }),
                          "Filter",
                        ],
                      }),
                      jsxs("button", {
                        className: `refresh-btn ${loading ? "spinning" : ""}`,
                        onClick: () => loadSummary(dateFrom, dateTo),
                        disabled: loading,
                        "aria-label": "Refresh dashboard",
                        children: [
                          jsxs("svg", {
                            width: "14",
                            height: "14",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "2.5",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            children: [
                              jsx("path", {
                                d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
                              }),
                              jsx("path", { d: "M21 3v5h-5" }),
                              jsx("path", {
                                d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
                              }),
                              jsx("path", { d: "M8 16H3v5" }),
                            ],
                          }),
                          loading ? "Updating…" : "Refresh",
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              filterOpen &&
                jsx("div", {
                  className: "date-drawer",
                  children: jsxs("div", {
                    className: "date-drawer-inner",
                    children: [
                      jsx("span", {
                        className: "date-drawer-label",
                        children: "Custom range",
                      }),
                      jsx(CommonDatePicker, {
                        value: dateFrom,
                        onChange: x,
                        ariaLabel: "From date",
                        size: "sm",
                      }),
                      jsx("span", {
                        className: "date-drawer-sep",
                        children: "→",
                      }),
                      jsx(CommonDatePicker, {
                        value: dateTo,
                        onChange: f,
                        ariaLabel: "To date",
                        size: "sm",
                      }),
                    ],
                  }),
                }),
              loading &&
                jsx("div", {
                  className: "dash-progress-bar",
                  role: "progressbar",
                  "aria-label": "Loading",
                  children: jsx("div", { className: "dash-progress-fill" }),
                }),
              loading &&
                !summary &&
                jsx("div", {
                  className: "dash-skeleton-grid",
                  children: [1, 2, 3, 4].map((se) =>
                    jsx("div", { className: "skeleton-kpi" }, se),
                  ),
                }),
              !loading &&
                !summary &&
                jsx("div", {
                  className: "dash-empty-state",
                  children: jsx(EmptyState, {
                    title: "No data",
                    message: "No data available for the selected range.",
                  }),
                }),
              summary &&
                jsxs("div", {
                  className: `dash-content ${loading ? "dash-busy" : ""}`,
                  children: [
                    jsxs("section", {
                      className: "kpi-strip",
                      "aria-label": "Key metrics",
                      children: [
                        canSales &&
                          jsxs("div", {
                            className: "kpi-card kpi-primary",
                            style: { "--i": 0 },
                            children: [
                              jsx("div", { className: "kpi-card-glow" }),
                              jsxs("div", {
                                className: "kpi-card-header",
                                children: [
                                  jsx("span", {
                                    className: "kpi-card-label",
                                    children: "Today's Sales",
                                  }),
                                  jsx("div", {
                                    className: "kpi-card-icon",
                                    children: jsx(IconSalesRegister, {
                                      "aria-hidden": "true",
                                      size: 16,
                                      strokeWidth: 2.2,
                                    }),
                                  }),
                                ],
                              }),
                              jsx("div", {
                                className: "kpi-card-value",
                                children:
                                  fmtMoneyINR(summary.kpis?.today_sales?.value || 0) ||
                                  "₹0.00",
                              }),
                              jsxs("div", {
                                className: "kpi-card-footer",
                                children: [
                                  jsxs("span", {
                                    className: "kpi-badge kpi-badge-up",
                                    children: [
                                      jsx(IconChevronsUp, {}),
                                      summary.kpis?.today_sales?.delta_pct != null
                                        ? `${Number(summary.kpis.today_sales.delta_pct).toFixed(1)}%`
                                        : "",
                                    ],
                                  }),
                                  jsxs("span", {
                                    className: "kpi-card-sub",
                                    children: [
                                      "vs ",
                                      fmtMoneyINR(
                                        summary.kpis?.today_sales?.prev_value || 0,
                                      ) || "₹0",
                                      " yesterday",
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        canSales &&
                          jsxs("div", {
                            className: "kpi-card kpi-success",
                            style: { "--i": 1 },
                            children: [
                              jsx("div", { className: "kpi-card-glow" }),
                              jsxs("div", {
                                className: "kpi-card-header",
                                children: [
                                  jsx("span", {
                                    className: "kpi-card-label",
                                    children: "Period Sales",
                                  }),
                                  jsx("div", {
                                    className: "kpi-card-icon",
                                    children: jsx(IconDayBook, {
                                      "aria-hidden": "true",
                                      size: 16,
                                      strokeWidth: 2.2,
                                    }),
                                  }),
                                ],
                              }),
                              jsx("div", {
                                className: "kpi-card-value kpi-val-success",
                                children:
                                  fmtMoneyINR(summary.kpis?.range_sales?.value || 0) ||
                                  "₹0.00",
                              }),
                              jsxs("div", {
                                className: "kpi-card-footer",
                                children: [
                                  jsxs("span", {
                                    className: "kpi-badge kpi-badge-neutral",
                                    children: [
                                      ymd(summary.meta?.range?.from),
                                      " → ",
                                      ymd(summary.meta?.range?.to),
                                    ],
                                  }),
                                  jsx("span", {
                                    className: "kpi-card-sub",
                                    children: "selected range",
                                  }),
                                ],
                              }),
                            ],
                          }),
                        canSales &&
                          jsxs("div", {
                            className: "kpi-card kpi-warning",
                            style: { "--i": 2 },
                            children: [
                              jsx("div", { className: "kpi-card-glow" }),
                              jsxs("div", {
                                className: "kpi-card-header",
                                children: [
                                  jsx("span", {
                                    className: "kpi-card-label",
                                    children: "Receivables",
                                  }),
                                  jsx("div", {
                                    className: "kpi-card-icon",
                                    children: jsx(IconWallet, {
                                      "aria-hidden": "true",
                                      size: 16,
                                      strokeWidth: 2.2,
                                    }),
                                  }),
                                ],
                              }),
                              jsx("div", {
                                className: "kpi-card-value kpi-val-warning",
                                children:
                                  fmtMoneyINR(summary.kpis?.receivables?.value || 0) ||
                                  "₹0.00",
                              }),
                              jsxs("div", {
                                className: "kpi-card-footer",
                                children: [
                                  jsxs("span", {
                                    className: "kpi-badge kpi-badge-down",
                                    children: [
                                      jsx(IconChevronsDown, {}),
                                      Number(
                                        summary.kpis?.receivables?.invoices || 0,
                                      ),
                                      " invoices",
                                    ],
                                  }),
                                  jsx("span", {
                                    className: "kpi-card-sub",
                                    children: "balance due",
                                  }),
                                ],
                              }),
                            ],
                          }),
                        canPurchases &&
                          jsxs("div", {
                            className: "kpi-card kpi-violet",
                            style: { "--i": 3 },
                            children: [
                              jsx("div", { className: "kpi-card-glow" }),
                              jsxs("div", {
                                className: "kpi-card-header",
                                children: [
                                  jsx("span", {
                                    className: "kpi-card-label",
                                    children: "Today's Purchases",
                                  }),
                                  jsx("div", {
                                    className: "kpi-card-icon",
                                    children: jsx(IconPurchaseOrder, {
                                      "aria-hidden": "true",
                                      size: 16,
                                      strokeWidth: 2.2,
                                    }),
                                  }),
                                ],
                              }),
                              jsx("div", {
                                className: "kpi-card-value",
                                children:
                                  fmtMoneyINR(summary.kpis?.today_purchases?.value || 0) ||
                                  "₹0.00",
                              }),
                              jsxs("div", {
                                className: "kpi-card-footer",
                                children: [
                                  jsxs("span", {
                                    className: "kpi-badge kpi-badge-neutral",
                                    children: [
                                      Number(
                                        summary.kpis?.today_purchases?.invoices || 0,
                                      ),
                                      " invoices",
                                    ],
                                  }),
                                  jsx("span", {
                                    className: "kpi-card-sub",
                                    children: "today",
                                  }),
                                ],
                              }),
                            ],
                          }),
                      ],
                    }),
                    jsxs("section", {
                      className: "qa-section",
                      "aria-label": "Quick actions",
                      children: [
                        jsx("div", {
                          className: "section-header",
                          children: jsxs("div", {
                            className: "section-title",
                            children: [jsx(IconDashZap, {}), "Quick Actions"],
                          }),
                        }),
                        jsx("div", {
                          className: "qa-rail",
                          children: [
                            {
                              kind: "NEW_BILL",
                              label: "New Bill",
                              sub: "Sales billing",
                              icon: jsx(IconPlus, {}),
                              accent: "var(--color-primary)",
                            },
                            {
                              kind: "NEW_PURCHASE",
                              label: "New Purchase",
                              sub: "Purchase invoice",
                              icon: jsx(IconPurchaseOrder, {
                                "aria-hidden": "true",
                                size: 18,
                                strokeWidth: 2.2,
                              }),
                              accent: "var(--color-success)",
                            },
                            {
                              kind: "SALES_RETURN",
                              label: "Sales Return",
                              sub: "Return entry",
                              icon: jsx(IconSalesReturn, {
                                "aria-hidden": "true",
                                size: 18,
                                strokeWidth: 2.2,
                              }),
                              accent: "var(--color-warning-strong)",
                            },
                            {
                              kind: "RECORD_PAYMENT",
                              label: "Record Payment",
                              sub: "Log payment",
                              icon: jsx(IconPayment, {
                                "aria-hidden": "true",
                                size: 18,
                                strokeWidth: 2.2,
                              }),
                              accent: "var(--color-success-strong)",
                            },
                          ].map(
                            ({ kind, label, sub, icon, accent }, idx) =>
                              jsxs(
                                "div",
                                {
                                  className: "qa-tile",
                                  role: "button",
                                  tabIndex: 0,
                                  style: { "--qa-accent": accent, "--qa-i": idx },
                                  onClick: () => runQuickAction(kind),
                                  onKeyDown: (ev) => onQuickKeyDown(ev, kind),
                                  children: [
                                    jsx("div", {
                                      className: "qa-tile-icon",
                                      children: icon,
                                    }),
                                    jsxs("div", {
                                      className: "qa-tile-text",
                                      children: [
                                        jsx("span", {
                                          className: "qa-tile-label",
                                          children: label,
                                        }),
                                        jsx("span", {
                                          className: "qa-tile-sub",
                                          children: sub,
                                        }),
                                      ],
                                    }),
                                    jsx("div", {
                                      className: "qa-tile-arrow",
                                      children: jsx(IconLinkOut, {}),
                                    }),
                                  ],
                                },
                                kind,
                              ),
                          ),
                        }),
                      ],
                    }),
                    jsxs("div", {
                      className: "dash-row dash-row-60-40",
                      children: [
                        jsxs("div", {
                          className: "panel",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx(IconDayBook, {
                                      "aria-hidden": "true",
                                      size: 15,
                                      strokeWidth: 2.2,
                                    }),
                                    "Sales Trend  Last 30 Days",
                                  ],
                                }),
                                jsxs("div", {
                                  className: "panel-controls",
                                  children: [
                                    jsx("div", {
                                      className: "chart-legend",
                                      children: [
                                        ["var(--color-primary)", "Sales"],
                                        [
                                          "var(--color-warning-strong)",
                                          "Purchase",
                                        ],
                                      ].map(([se, H]) =>
                                        jsxs(
                                          "span",
                                          {
                                            className: "legend-item",
                                            children: [
                                              jsx("span", {
                                                className: "legend-dot",
                                                style: { background: se },
                                              }),
                                              H,
                                            ],
                                          },
                                          H,
                                        ),
                                      ),
                                    }),
                                    jsx("div", {
                                      className: "seg-ctrl",
                                      "aria-label": "Chart type",
                                      children: [
                                        ["LINE", "Line"],
                                        ["AREA", "Area"],
                                        ["BAR", "Bar"],
                                      ].map(([chartType, label]) =>
                                        jsx(
                                          "button",
                                          {
                                            className: `seg-btn ${trendChartType === chartType ? "active" : ""}`,
                                            onClick: () => setTrendChartType(chartType),
                                            children: label,
                                          },
                                          chartType,
                                        ),
                                      ),
                                    }),
                                    jsxs("button", {
                                      className: "panel-action",
                                      onClick: () => navigate("/reports/day-book"),
                                      children: ["Day Book ", jsx(IconLinkOut, {})],
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            jsxs("div", {
                              className: "panel-body",
                              children: [
                                trendChartType === "BAR"
                                  ? jsx(BarChart, {
                                      height: 200,
                                      groups: trendCharts.barGroups,
                                      variant: "GROUPED",
                                      yFormatter: (se) => fmtMoneyINR(se) || "₹0",
                                    })
                                  : jsx(LineAreaChart, {
                                      height: 200,
                                      series: trendCharts.lineSeries,
                                      variant: trendChartType === "AREA" ? "AREA" : "LINE",
                                      yFormatter: (se) => fmtMoneyINR(se) || "₹0",
                                    }),
                                jsxs("div", {
                                  className: "chart-axis-labels",
                                  children: [
                                    jsx("span", {
                                      children: ymd(summary.meta?.range?.from),
                                    }),
                                    jsx("span", {
                                      children: ymd(summary.meta?.range?.to),
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                        jsxs("div", {
                          className: "panel panel-alerts",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx("span", {
                                      className: "icon-danger",
                                      children: jsx(IconAlert, {}),
                                    }),
                                    "Alerts",
                                  ],
                                }),
                                jsxs("button", {
                                  className: "panel-action",
                                  onClick: () =>
                                    navigate("/reports/inventory?tab=non-moving"),
                                  children: ["View all ", jsx(IconLinkOut, {})],
                                }),
                              ],
                            }),
                            jsxs("div", {
                              className: "alert-list",
                              children: [
                                (Array.isArray(summary.widgets?.alerts)
                                  ? summary.widgets.alerts
                                  : []
                                )
                                  .slice(0, 6)
                                  .map((se, H) =>
                                    jsxs(
                                      "div",
                                      {
                                        className: "alert-row",
                                        children: [
                                          jsx("div", {
                                            className: `alert-pip ${se.severity || "amber"}`,
                                          }),
                                          jsxs("div", {
                                            className: "alert-info",
                                            children: [
                                              jsx("div", {
                                                className: "alert-name",
                                                children: se.title || "Alert",
                                              }),
                                              jsx("div", {
                                                className: "alert-meta",
                                                children: se.subtitle || "",
                                              }),
                                            ],
                                          }),
                                          jsx("div", {
                                            className: `alert-badge ${se.severity || "amber"}`,
                                            children: se.badge || "",
                                          }),
                                        ],
                                      },
                                      `${se.kind || "alert"}-${H}`,
                                    ),
                                  ),
                                (!Array.isArray(summary.widgets?.alerts) ||
                                  summary.widgets.alerts.length === 0) &&
                                  jsx("div", {
                                    className: "panel-body",
                                    children: jsx(EmptyState, {
                                      title: "No alerts",
                                      message: "No alerts for this range.",
                                    }),
                                  }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                    jsxs("div", {
                      className: "dash-row dash-row-50-50",
                      children: [
                        jsxs("div", {
                          className: "panel",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx(IconDayBook, {
                                      "aria-hidden": "true",
                                      size: 15,
                                      strokeWidth: 2.2,
                                    }),
                                    "Daily Sales  This Week",
                                  ],
                                }),
                                jsxs("div", {
                                  className: "panel-controls",
                                  children: [
                                    jsx("div", {
                                      className: "seg-ctrl",
                                      "aria-label": "Weekly chart type",
                                      children: [
                                        ["BAR", "Bar"],
                                        ["LINE", "Line"],
                                      ].map(([chartType, label]) =>
                                        jsx(
                                          "button",
                                          {
                                            className: `seg-btn ${weekChartType === chartType ? "active" : ""}`,
                                            onClick: () => setWeekChartType(chartType),
                                            children: label,
                                          },
                                          chartType,
                                        ),
                                      ),
                                    }),
                                    jsxs("button", {
                                      className: "panel-action",
                                      onClick: () => navigate("/reports/day-book"),
                                      children: ["Day Book ", jsx(IconLinkOut, {})],
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            jsx("div", {
                              className: "panel-body",
                              children:
                                weekChartType === "LINE"
                                  ? jsx(LineAreaChart, {
                                      height: 160,
                                      series: [
                                        {
                                          id: "week_sales",
                                          label: "Sales",
                                          color: "var(--color-primary)",
                                          values: (salesWeek.rows || []).map((se) => ({
                                            xLabel:
                                              ymd(se.day)?.slice(5) ||
                                              String(se.day || ""),
                                            y: Number(se.sales_total || 0),
                                          })),
                                        },
                                      ],
                                      variant: "LINE",
                                      yFormatter: (se) => fmtMoneyINR(se) || "₹0",
                                    })
                                  : jsx(BarChart, {
                                      height: 160,
                                      groups: (salesWeek.rows || []).map((se) => ({
                                        xLabel:
                                          ymd(se.day)?.slice(8, 10) ||
                                          String(se.day || ""),
                                        series: [
                                          {
                                            id: "sales",
                                            label: "Sales",
                                            color: "var(--color-primary)",
                                            y: Number(se.sales_total || 0),
                                          },
                                        ],
                                      })),
                                      variant: "GROUPED",
                                      yFormatter: (se) => fmtMoneyINR(se) || "₹0",
                                    }),
                            }),
                          ],
                        }),
                        jsxs("div", {
                          className: "panel",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx(IconPayment, {
                                      "aria-hidden": "true",
                                      size: 15,
                                      strokeWidth: 2.2,
                                    }),
                                    "Payment Modes",
                                  ],
                                }),
                                jsx("div", {
                                  className: "seg-ctrl",
                                  "aria-label": "Payment chart type",
                                  children: [
                                    ["DONUT", "Donut"],
                                    ["BAR", "Bar"],
                                    ["STACKED", "Stack"],
                                  ].map(([chartType, label]) =>
                                    jsx(
                                      "button",
                                      {
                                        className: `seg-btn ${payChartType === chartType ? "active" : ""}`,
                                        onClick: () => setPayChartType(chartType),
                                        children: label,
                                      },
                                      chartType,
                                    ),
                                  ),
                                }),
                              ],
                            }),
                            jsx("div", {
                              className: "panel-body",
                              children:
                                payChartType === "BAR"
                                  ? jsx(BarChart, {
                                      height: 180,
                                      groups: paymentModes.rows.map((se) => ({
                                        xLabel: String(se.mode),
                                        series: [
                                          {
                                            id: String(se.mode),
                                            label: String(se.mode),
                                            color: payModeColor(se.mode),
                                            y: Number(se.total || 0),
                                          },
                                        ],
                                      })),
                                      variant: "GROUPED",
                                      yFormatter: (se) => fmtMoneyINR(se) || "₹0",
                                    })
                                  : payChartType === "STACKED"
                                    ? jsx(BarChart, {
                                        height: 180,
                                        groups: [
                                          {
                                            xLabel: "Total",
                                            series: paymentModes.rows.map((se) => ({
                                              id: String(se.mode),
                                              label: String(se.mode),
                                              color: payModeColor(se.mode),
                                              y: Number(se.total || 0),
                                            })),
                                          },
                                        ],
                                        variant: "STACKED",
                                        yFormatter: (se) => fmtMoneyINR(se) || "₹0",
                                      })
                                    : jsx(DonutChart, {
                                        height: 180,
                                        slices: paymentModes.rows.map((se) => ({
                                          id: String(se.mode),
                                          label: String(se.mode),
                                          value: Number(se.total || 0),
                                          color: payModeColor(se.mode),
                                        })),
                                        centerLabel: fmtMoneyINR(paymentModes.total || 0) || "₹0",
                                        valueFormatter: (se) => fmtMoneyINR(se) || "₹0",
                                      }),
                            }),
                          ],
                        }),
                      ],
                    }),
                    jsxs("div", {
                      className: "dash-row dash-row-3col",
                      children: [
                        jsxs("div", {
                          className: "panel",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx(IconPurchaseOrder, {
                                      "aria-hidden": "true",
                                      size: 15,
                                      strokeWidth: 2.2,
                                    }),
                                    "Top Products",
                                  ],
                                }),
                                jsxs("button", {
                                  className: "panel-action",
                                  onClick: () => navigate("/quality-master"),
                                  children: ["All ", jsx(IconLinkOut, {})],
                                }),
                              ],
                            }),
                            jsxs("div", {
                              className: "panel-body prod-bars",
                              children: [
                                filteredProducts.slice(0, 5).map((se, H) =>
                                  jsxs(
                                    "div",
                                    {
                                      className: "prod-bar-row",
                                      style: { "--delay": `${H * 60}ms` },
                                      children: [
                                        jsxs("div", {
                                          className: "prod-bar-meta",
                                          children: [
                                            jsx("span", {
                                              className: "prod-bar-name",
                                              children: se.product_name,
                                            }),
                                            jsx("span", {
                                              className: "prod-bar-val",
                                              children: fmtMoneyINR(se.total) || "₹0.00",
                                            }),
                                          ],
                                        }),
                                        jsx("div", {
                                          className: "prod-bar-track",
                                          children: jsx("div", {
                                            className: "prod-bar-fill",
                                            style: {
                                              width: animBars
                                                ? `${(Number(se.total || 0) / topProducts.max) * 100}%`
                                                : "0%",
                                              background: prodBarColors[H % prodBarColors.length],
                                              transitionDelay: `${H * 60}ms`,
                                            },
                                          }),
                                        }),
                                      ],
                                    },
                                    String(se.product_id || H),
                                  ),
                                ),
                                filteredProducts.length === 0 &&
                                  jsx(EmptyState, {
                                    title: "No products",
                                    message: "No products match your search.",
                                  }),
                              ],
                            }),
                          ],
                        }),
                        jsxs("div", {
                          className: "panel",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx(IconCustomerMark, {
                                      "aria-hidden": "true",
                                      size: 15,
                                      strokeWidth: 2.2,
                                    }),
                                    "Top Customers",
                                  ],
                                }),
                                jsxs("button", {
                                  className: "panel-action",
                                  onClick: () =>
                                    navigate("/reports/ledger?tab=customer"),
                                  children: ["Ledger ", jsx(IconLinkOut, {})],
                                }),
                              ],
                            }),
                            jsx("div", {
                              className: "table-wrap",
                              children: jsxs("table", {
                                className: "data-table",
                                children: [
                                  jsx("thead", {
                                    children: jsxs("tr", {
                                      children: [
                                        jsx("th", { children: "Customer" }),
                                        jsx("th", {
                                          className: "r",
                                          children: "Billed",
                                        }),
                                        jsx("th", {
                                          className: "r",
                                          children: "Balance",
                                        }),
                                        jsx("th", { children: "Status" }),
                                      ],
                                    }),
                                  }),
                                  jsxs("tbody", {
                                    children: [
                                      filteredCustomers.slice(0, 5).map((se) =>
                                        jsxs(
                                          "tr",
                                          {
                                            children: [
                                              jsx("td", {
                                                className: "td-bold",
                                                children: se.customer_name,
                                              }),
                                              jsx("td", {
                                                className: "r",
                                                children:
                                                  fmtMoneyINR(se.billed) || "₹0.00",
                                              }),
                                              jsx("td", {
                                                className: "r",
                                                children:
                                                  fmtMoneyINR(se.balance) || "₹0.00",
                                              }),
                                              jsx("td", {
                                                children: jsx("span", {
                                                  className: `status-pill ${String(se.pay_status || "").toUpperCase() === "PAID" ? "green" : String(se.pay_status || "").toUpperCase() === "UNPAID" ? "red" : "amber"}`,
                                                  children: se.pay_status
                                                    ? String(se.pay_status)[0] +
                                                      String(se.pay_status)
                                                        .slice(1)
                                                        .toLowerCase()
                                                    : "",
                                                }),
                                              }),
                                            ],
                                          },
                                          String(se.customer_id),
                                        ),
                                      ),
                                      filteredCustomers.length === 0 &&
                                        jsx("tr", {
                                          children: jsx("td", {
                                            colSpan: 4,
                                            children: jsx(EmptyState, {
                                              title: "No customers",
                                              message: "No data found.",
                                            }),
                                          }),
                                        }),
                                    ],
                                  }),
                                ],
                              }),
                            }),
                          ],
                        }),
                        jsxs("div", {
                          className: "panel",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx("span", {
                                      className: "icon-danger",
                                      children: jsx(IconAlert, {}),
                                    }),
                                    "Expiry Watch",
                                  ],
                                }),
                                jsxs("button", {
                                  className: "panel-action",
                                  onClick: () => navigate("/quality-master"),
                                  children: ["All Batches ", jsx(IconLinkOut, {})],
                                }),
                              ],
                            }),
                            jsx("div", {
                              className: "table-wrap",
                              children: jsxs("table", {
                                className: "data-table",
                                children: [
                                  jsx("thead", {
                                    children: jsxs("tr", {
                                      children: [
                                        jsx("th", {
                                          children: "Product · Batch",
                                        }),
                                        jsx("th", {
                                          className: "r",
                                          children: "Stock",
                                        }),
                                        jsx("th", {
                                          className: "r",
                                          children: "Expires",
                                        }),
                                        jsx("th", { children: "Days" }),
                                      ],
                                    }),
                                  }),
                                  jsxs("tbody", {
                                    children: [
                                      (Array.isArray(summary.widgets?.expiry_watch)
                                        ? summary.widgets.expiry_watch
                                        : []
                                      )
                                        .slice(0, 5)
                                        .map((se) => {
                                          const H = daysUntil(se.expiry_date),
                                            Le =
                                              H != null && H <= 14
                                                ? "red"
                                                : H != null && H <= 45
                                                  ? "amber"
                                                  : "green";
                                          return jsxs(
                                            "tr",
                                            {
                                              children: [
                                                jsx("td", {
                                                  className: "td-bold",
                                                  children: `${se.product_name} ${se.batch_no}`,
                                                }),
                                                jsx("td", {
                                                  className: "r",
                                                  children: Number(
                                                    se.current_stock || 0,
                                                  ),
                                                }),
                                                jsx("td", {
                                                  className: "r",
                                                  children: ymd(se.expiry_date),
                                                }),
                                                jsx("td", {
                                                  children: jsx("span", {
                                                    className: `status-pill ${Le}`,
                                                    children:
                                                      H == null ? "" : `${H}d`,
                                                  }),
                                                }),
                                              ],
                                            },
                                            String(se.batch_id),
                                          );
                                        }),
                                      (!canBatches ||
                                        !Array.isArray(
                                          summary.widgets?.expiry_watch,
                                        ) ||
                                        summary.widgets.expiry_watch.length === 0) &&
                                        jsx("tr", {
                                          children: jsx("td", {
                                            colSpan: 4,
                                            children: jsx(EmptyState, {
                                              title: "No expiry data",
                                              message: $
                                                ? "No expiring batches."
                                                : "No batch permission.",
                                            }),
                                          }),
                                        }),
                                    ],
                                  }),
                                ],
                              }),
                            }),
                          ],
                        }),
                      ],
                    }),
                    jsxs("div", {
                      className: "panel panel-transactions",
                      children: [
                        jsxs("div", {
                          className: "panel-header",
                          children: [
                            jsxs("div", {
                              className: "panel-title",
                              children: [
                                jsx(IconSalesRegister, {
                                  "aria-hidden": "true",
                                  size: 15,
                                  strokeWidth: 2.2,
                                }),
                                "Recent Transactions",
                              ],
                            }),
                            jsxs("div", {
                              className: "panel-controls",
                              children: [
                                jsxs("div", {
                                  className: "seg-ctrl",
                                  children: [
                                    jsx("button", {
                                      className: `seg-btn ${recentTab === "SALES" ? "active" : ""}`,
                                      onClick: () => setRecentTab("SALES"),
                                      children: "Sales",
                                    }),
                                    jsx("button", {
                                      className: `seg-btn ${recentTab === "PURCHASES" ? "active" : ""}`,
                                      onClick: () => setRecentTab("PURCHASES"),
                                      children: "Purchases",
                                    }),
                                    jsx("button", {
                                      className: `seg-btn ${recentTab === "RETURNS" ? "active" : ""}`,
                                      onClick: () => setRecentTab("RETURNS"),
                                      children: "Returns",
                                    }),
                                  ],
                                }),
                                jsxs("button", {
                                  className: "panel-action",
                                  onClick: () =>
                                    navigate(
                                      recentTab === "SALES"
                                        ? "/sales-billing"
                                        : recentTab === "PURCHASES"
                                          ? "/purchase-invoices"
                                          : "/sales-returns",
                                    ),
                                  children: ["View All ", jsx(IconLinkOut, {})],
                                }),
                              ],
                            }),
                          ],
                        }),
                        jsx("div", {
                          className: "table-scroll-wrap",
                          children: jsxs("table", {
                            className: "data-table data-table-lg",
                            children: [
                              jsx("thead", {
                                children: jsxs("tr", {
                                  children: [
                                    jsx("th", { children: "#" }),
                                    jsx("th", { children: "Invoice" }),
                                    jsx("th", { children: "Party" }),
                                    jsx("th", { children: "Date" }),
                                    jsx("th", { children: "Items" }),
                                    jsx("th", {
                                      className: "r",
                                      children: "Total",
                                    }),
                                    jsx("th", {
                                      className: "r",
                                      children: "Paid",
                                    }),
                                    jsx("th", {
                                      className: "r",
                                      children: "Balance",
                                    }),
                                    jsx("th", { children: "Status" }),
                                    jsx("th", { children: "Payment" }),
                                  ],
                                }),
                              }),
                              jsxs("tbody", {
                                children: [
                                  filteredRecent
                                    .slice(0, 6)
                                    .map((row, idx) =>
                                      jsxs(
                                        "tr",
                                        {
                                          children: [
                                            jsx("td", {
                                              className: "td-num",
                                              children: idx + 1,
                                            }),
                                            jsx("td", {
                                              className: "td-bold",
                                              children:
                                                row.invoice_number ||
                                                row.return_number ||
                                                "",
                                            }),
                                            jsx("td", {
                                              children:
                                                row.customer_name ||
                                                row.vendor_name ||
                                                row.party_name ||
                                                "",
                                            }),
                                            jsx("td", {
                                              children: ymd(
                                                row.invoice_date ||
                                                  row.return_date,
                                              ),
                                            }),
                                            jsx("td", {
                                              children: Number(
                                                row.item_count || 0,
                                              ),
                                            }),
                                            jsx("td", {
                                              className: "r",
                                              children:
                                                fmtMoneyINR(
                                                  row.total_amount ||
                                                    row.total_return_amount ||
                                                    0,
                                                ) || "₹0.00",
                                            }),
                                            jsx("td", {
                                              className: "r",
                                              children:
                                                fmtMoneyINR(row.amount_paid || 0) ||
                                                "₹0.00",
                                            }),
                                            jsx("td", {
                                              className: "r",
                                              children:
                                                fmtMoneyINR(row.balance_due || 0) ||
                                                "₹0.00",
                                            }),
                                            jsx("td", {
                                              children: jsx("span", {
                                                className: `status-pill ${statusPillClass(row.status)}`,
                                                children: String(
                                                  row.status || "",
                                                ),
                                              }),
                                            }),
                                            jsx("td", {
                                              children: jsx("span", {
                                                className: `status-pill ${statusPillClass(row.payment_status)}`,
                                                children: String(
                                                  row.payment_status || "",
                                                ),
                                              }),
                                            }),
                                          ],
                                        },
                                        String(row.id || idx),
                                      ),
                                    ),
                                  filteredRecent.length === 0 &&
                                    jsx("tr", {
                                      children: jsx("td", {
                                        colSpan: 10,
                                        children: jsx(EmptyState, {
                                          title: "No transactions",
                                          message: "No rows found.",
                                        }),
                                      }),
                                    }),
                                ],
                              }),
                            ],
                          }),
                        }),
                      ],
                    }),
                    jsxs("div", {
                      className: "dash-row dash-row-50-50",
                      style: { marginBottom: 0 },
                      children: [
                        jsxs("div", {
                          className: "panel",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx(IconPurchaseOrder, {
                                      "aria-hidden": "true",
                                      size: 15,
                                      strokeWidth: 2.2,
                                    }),
                                    "Stock Summary",
                                  ],
                                }),
                                jsxs("button", {
                                  className: "panel-action",
                                  onClick: () => navigate("/quality-master"),
                                  children: ["Products ", jsx(IconLinkOut, {})],
                                }),
                              ],
                            }),
                            jsx("div", {
                              className: "table-wrap",
                              children: jsxs("table", {
                                className: "data-table",
                                children: [
                                  jsx("thead", {
                                    children: jsxs("tr", {
                                      children: [
                                        jsx("th", { children: "Product" }),
                                        jsx("th", {
                                          className: "r",
                                          children: "Batches",
                                        }),
                                        jsx("th", {
                                          className: "r",
                                          children: "Qty",
                                        }),
                                        jsx("th", { children: "Health" }),
                                      ],
                                    }),
                                  }),
                                  jsxs("tbody", {
                                    children: [
                                      (Array.isArray(summary.widgets?.stock_summary)
                                        ? summary.widgets.stock_summary
                                        : []
                                      )
                                        .slice(0, 5)
                                        .map((se) =>
                                          jsxs(
                                            "tr",
                                            {
                                              children: [
                                                jsx("td", {
                                                  className: "td-bold",
                                                  children: se.product_name,
                                                }),
                                                jsx("td", {
                                                  className: "r",
                                                  children: Number(
                                                    se.batch_count || 0,
                                                  ),
                                                }),
                                                jsx("td", {
                                                  className: "r",
                                                  children: Number(
                                                    se.total_qty || 0,
                                                  ),
                                                }),
                                                jsx("td", {
                                                  children: jsx("span", {
                                                    className: `status-pill ${String(se.health || "").toUpperCase() === "GOOD" ? "green" : String(se.health || "").toUpperCase() === "NO_STOCK" ? "red" : "amber"}`,
                                                    children:
                                                      se.health_label ||
                                                      se.health,
                                                  }),
                                                }),
                                              ],
                                            },
                                            String(se.product_id),
                                          ),
                                        ),
                                      (!Array.isArray(
                                        summary.widgets?.stock_summary,
                                      ) ||
                                        summary.widgets.stock_summary.length === 0) &&
                                        jsx("tr", {
                                          children: jsx("td", {
                                            colSpan: 4,
                                            children: jsx(EmptyState, {
                                              title: "No stock data",
                                              message:
                                                "No stock summary available.",
                                            }),
                                          }),
                                        }),
                                    ],
                                  }),
                                ],
                              }),
                            }),
                          ],
                        }),
                        jsxs("div", {
                          className: "panel",
                          children: [
                            jsxs("div", {
                              className: "panel-header",
                              children: [
                                jsxs("div", {
                                  className: "panel-title",
                                  children: [
                                    jsx(IconPayment, {
                                      "aria-hidden": "true",
                                      size: 15,
                                      strokeWidth: 2.2,
                                    }),
                                    "Supplier Payables",
                                  ],
                                }),
                                jsxs("button", {
                                  className: "panel-action",
                                  onClick: () =>
                                    navigate("/reports/ledger?tab=supplier"),
                                  children: ["Supplier Ledger ", jsx(IconLinkOut, {})],
                                }),
                              ],
                            }),
                            jsx("div", {
                              className: "table-wrap",
                              children: jsxs("table", {
                                className: "data-table",
                                children: [
                                  jsx("thead", {
                                    children: jsxs("tr", {
                                      children: [
                                        jsx("th", { children: "Supplier" }),
                                        jsx("th", {
                                          className: "r",
                                          children: "Outstanding",
                                        }),
                                        jsx("th", {
                                          className: "r",
                                          children: "Overdue",
                                        }),
                                        jsx("th", { children: "Status" }),
                                      ],
                                    }),
                                  }),
                                  jsxs("tbody", {
                                    children: [
                                      (Array.isArray(
                                        summary.widgets?.supplier_payables,
                                      )
                                        ? summary.widgets.supplier_payables
                                        : []
                                      )
                                        .slice(0, 5)
                                        .map((se) =>
                                          jsxs(
                                            "tr",
                                            {
                                              children: [
                                                jsx("td", {
                                                  className: "td-bold",
                                                  children:
                                                    se.vendor_name || "",
                                                }),
                                                jsx("td", {
                                                  className: "r",
                                                  children:
                                                    fmtMoneyINR(se.outstanding) ||
                                                    "₹0.00",
                                                }),
                                                jsx("td", {
                                                  className: "r",
                                                  children:
                                                    fmtMoneyINR(se.overdue) || "₹0.00",
                                                }),
                                                jsx("td", {
                                                  children: jsx("span", {
                                                    className: `status-pill ${Number(se.overdue || 0) > 0 ? "red" : "green"}`,
                                                    children:
                                                      Number(se.overdue || 0) >
                                                      0
                                                        ? "Overdue"
                                                        : "Clear",
                                                  }),
                                                }),
                                              ],
                                            },
                                            String(se.vendor_id),
                                          ),
                                        ),
                                      (!Array.isArray(
                                        summary.widgets?.supplier_payables,
                                      ) ||
                                        summary.widgets.supplier_payables.length ===
                                          0) &&
                                        jsx("tr", {
                                          children: jsx("td", {
                                            colSpan: 4,
                                            children: jsx(EmptyState, {
                                              title: "No payables",
                                              message:
                                                "No supplier balances due.",
                                            }),
                                          }),
                                        }),
                                    ],
                                  }),
                                ],
                              }),
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
            ],
          }),
        ],
      }),
    }),
  });
}