import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./CommonTable.css";

function IconSearch() {
  return (
    <svg
      className="ctIco ctIco3d"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7.25" />
      <path d="M20.25 20.25l-4.15-4.15" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg
      className="ctIco ctIco3d"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconChevLeft() {
  return (
    <svg
      className="ctIco ctIco3d"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevRight() {
  return (
    <svg
      className="ctIco ctIco3d"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconSort({ dir }) {
  const d = String(dir || "").toLowerCase();
  if (d === "asc") {
    return (
      <svg
        className="ctIco ctIco3d"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 14l4-4 4 4" />
      </svg>
    );
  }
  if (d === "desc") {
    return (
      <svg
        className="ctIco ctIco3d"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 10l4 4 4-4" />
      </svg>
    );
  }
  return (
    <svg
      className="ctIco ctIco3d"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 10l4-4 4 4" opacity="0.45" />
      <path d="M8 14l4 4 4-4" opacity="0.45" />
    </svg>
  );
}

function initials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "U";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function statusClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "ctStatus_approved";
  if (s === "PENDING") return "ctStatus_pending";
  if (s === "REJECTED") return "ctStatus_rejected";
  if (s === "BLOCKED") return "ctStatus_blocked";
  return "ctStatus_unknown";
}

function roleClass(role) {
  const r = String(role || "").toUpperCase();
  if (r === "WHOLESALER") return "ctRole_wholesaler";
  if (r === "RETAILER") return "ctRole_retailer";
  if (r === "ADMIN") return "ctRole_admin";
  if (r === "PHARMACIST") return "ctRole_pharmacist";
  return "ctRole_unknown";
}

/**
 * CommonTable  HTML developer table adapted to class-based CSS.
 *
 * Props:
 * - title, subtitle
 * - countText: string (e.g. "12 users")
 * - search: string, onSearchChange(v)
 * - filter: single { value, options, onChange } (optional; use filters for multiple)
 * - filters: array of filter objects like filter (optional)
 * - primaryAction: { label, onClick } (optional)
 * - rows: array
 * - selectedId: string
 * - onRowClick(row)
 * - getRowId(row) => string
 * - columns: [{ id, header, render(row), align?, sortable? }]
 * - sort, onSortChange (optional; column sorting)
 * - pagination: { page, totalPages, totalItems, from, to, onPrev, onPage, onNext }
 */
export default function CommonTable({
  title,
  subtitle,
  countText,
  loading = false,
  controlsPlacement = "below", // "below" | "top"
  search,
  onSearchChange,
  filter,
  filters,
  sort,
  onSortChange,
  primaryAction,
  rows = [],
  selectedId,
  onRowClick,
  onRowDelete,
  getRowId,
  columns = [],
  pagination
}) {
  const keyFn = getRowId || ((r) => r?.id);
  const isLoading =
    Boolean(loading) ||
    String(countText || "")
      .toLowerCase()
      .includes("loading");

  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  const pageButtons = useMemo(() => {
    const total = Number(pagination?.totalPages || 1);
    const cur = Number(pagination?.page || 1);
    const max = Math.max(1, Math.min(total, 7));
    if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(cur - 2, total - (max - 1)));
    return Array.from({ length: max }, (_, i) => start + i);
  }, [pagination?.page, pagination?.totalPages]);

  const skelRows = useMemo(() => {
    const colCount = Math.max(1, columns.length || 1);
    const n = Math.max(4, Math.min(8, pagination?.pageSize || 6));
    return Array.from({ length: n }, (_, i) => ({
      key: `sk_${i}`,
      cells: Array.from({ length: colCount }, (_, j) => {
        const seed = (i * 7 + j * 11) % 100;
        const w = j === 0 ? 68 : j === colCount - 1 ? 36 : 52 + (seed % 28);
        return { w };
      })
    }));
  }, [columns.length, pagination?.pageSize]);

  const filterList = Array.isArray(filters) ? filters.filter(Boolean) : filter ? [filter] : [];

  const controls = (
    <div className={`ctControls ${controlsPlacement === "top" ? "ctControls_top" : ""}`}>
      <div className="ctSearchWrap" role="search">
        <span className="ctSearchIco" aria-hidden="true">
          <IconSearch />
        </span>
        <input
          className="ctSearchInput"
          ref={searchRef}
          value={search || ""}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search…"
          aria-label="Search"
        />
        {search ? (
          <button className="ctClearBtn" type="button" aria-label="Clear search" onClick={() => onSearchChange?.("")}>
            ×
          </button>
        ) : null}
      </div>

      {filterList.map((f, idx) => (
        <select
          key={f.id || f.label || String(idx)}
          className="ctSelect"
          value={f.value}
          onChange={(e) => f.onChange?.(e.target.value)}
          aria-label={f.ariaLabel || f.label || "Filter"}
        >
          {f.options?.map((o) => (
            <option key={String(o.value)} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );

  function isEditableEl(el) {
    const node = el;
    if (!node) return false;
    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (node.isContentEditable) return true;
    return false;
  }

  function isKeyboardBlocked() {
    if (document.querySelector(".cmRoot")) return true;
    if (document.querySelector('.udpRoot[aria-hidden="false"]')) return true;
    if (document.querySelector('[role="dialog"][aria-hidden="false"]')) return true;
    if (document.querySelector('[role="listbox"]')) return true;
    return false;
  }

  function useTableShortcuts({ enabled, wrapRef, searchRef, rowIds, onCreate, onOpenById, onDeleteById, tableControlActive }) {
    const [kbdId, setKbdId] = useState("");

    useEffect(() => {
      if (!enabled) return;
      if (!rowIds.length) {
        setKbdId("");
        return;
      }
      if (kbdId && rowIds.includes(String(kbdId))) return;
      setKbdId(String(rowIds[0]));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, rowIds.join("|")]);

    const move = useCallback(
      (dir) => {
        if (!rowIds.length) return;
        const curIdx = kbdId ? rowIds.indexOf(String(kbdId)) : -1;
        const nextIdx = Math.max(0, Math.min(rowIds.length - 1, (curIdx >= 0 ? curIdx : 0) + dir));
        setKbdId(String(rowIds[nextIdx]));
      },
      [kbdId, rowIds]
    );

    useEffect(() => {
      if (!enabled) return;
      function onKeyDown(e) {
        // If a modal/drawer overlay is open, do NOT handle table shortcuts.
        if (isKeyboardBlocked()) return;

        const wrap = wrapRef.current;
        if (!wrap) return;

        const active = document.activeElement;
        const inTable = active ? wrap.contains(active) : false;

        const keyLower = String(e.key || "").toLowerCase();
        if (((e.ctrlKey || e.metaKey) && keyLower === "f") || (e.altKey && keyLower === "f")) {
          if (!inTable) return;
          e.preventDefault();
          const inp = searchRef.current;
          if (inp && typeof inp.focus === "function") {
            inp.focus();
            inp.select?.();
          }
          return;
        }

        if (!inTable) return;
        if (isEditableEl(active)) return;
        if (!tableControlActive && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Delete" || e.key === "Backspace")) return;

        if (((e.ctrlKey || e.metaKey) && e.shiftKey && keyLower === "n") || (e.altKey && keyLower === "n")) {
          if (!onCreate) return;
          e.preventDefault();
          onCreate();
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
          return;
        }
        if (e.key === "Enter") {
          if (!onOpenById || !kbdId) return;
          e.preventDefault();
          onOpenById(String(kbdId));
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          if (!onDeleteById || !kbdId) return;
          e.preventDefault();
          onDeleteById(String(kbdId));
        }
      }

      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, [enabled, wrapRef, searchRef, move, kbdId, onCreate, onOpenById, onDeleteById, tableControlActive]);

    return { kbdId, setKbdId };
  }

  const rowIds = useMemo(() => (rows || []).map((r) => String(keyFn(r))), [rows, keyFn]);
  const [controlZone, setControlZone] = useState("table");

  const onOpenById = useCallback(
    (id) => {
      const row = (rows || []).find((r) => String(keyFn(r)) === String(id));
      if (row) onRowClick?.(row);
    },
    [rows, keyFn, onRowClick]
  );

  const onDeleteById = useCallback(
    (id) => {
      if (!onRowDelete) return;
      const row = (rows || []).find((r) => String(keyFn(r)) === String(id));
      if (row) onRowDelete(row);
    },
    [rows, keyFn, onRowDelete]
  );

  const { kbdId, setKbdId } = useTableShortcuts({
    enabled: true,
    wrapRef,
    searchRef,
    rowIds,
    onCreate: primaryAction?.onClick,
    onOpenById,
    onDeleteById,
    tableControlActive: controlZone === "table"
  });

  useEffect(() => {
    function onFocusIn(e) {
      const t = e.target;
      if (t?.closest?.(".sidebar")) setControlZone("sidebar");
      else if (wrapRef.current?.contains?.(t)) setControlZone("table");
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  useEffect(() => {
    function onPointerDown(e) {
      if (isKeyboardBlocked()) return;
      const t = e.target;
      if (!t?.closest) return;
      if (t.closest(".sidebar")) {
        setControlZone("sidebar");
        return;
      }
      if (isEditableEl(t) || t.closest("[role='dialog'], .cmRoot, .udpRoot, .userMenu")) return;
      if (!t.closest("[data-app-main]")) return;
      const wrap = wrapRef.current;
      if (!wrap) return;
      setControlZone("table");
      if (rowIds.length && (!kbdId || !rowIds.includes(String(kbdId)))) setKbdId(String(rowIds[0]));
      requestAnimationFrame(() => {
        try {
          wrap.focus({ preventScroll: true });
        } catch {
          wrap.focus?.();
        }
      });
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [rowIds, kbdId, setKbdId]);

  return (
    <div ref={wrapRef} className={`ct ${isLoading ? "ct_loading" : ""}`} tabIndex={-1} data-ct-control-zone={controlZone} aria-label="Data table">
      <div className="ctTop">
        <div className="ctTitleBlock">
          {title ? <h1 className="ctTitle">{title}</h1> : null}
          {subtitle ? <p className="ctSub">{subtitle}</p> : null}
          {countText ? <div className="ctCount">{countText}</div> : null}
        </div>

        <div className="ctTopRight">
          {controlsPlacement === "top" ? controls : null}
          {primaryAction ? (
            <button className="ctAddBtn" type="button" onClick={primaryAction.onClick}>
              <span className="ctAddIco" aria-hidden="true">
                <IconPlus />
              </span>
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      </div>

      {controlsPlacement === "below" ? controls : null}

      <div className="ctCard">
        <table className="ctTable" aria-busy={isLoading ? "true" : "false"}>
          <thead className="ctThead">
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable === false ? false : Boolean(onSortChange);
                const active = String(sort?.by || "") === String(c.id || "");
                const dir = active ? String(sort?.dir || "") : "";
                return (
                  <th
                    key={c.id}
                    className={`ctTh ${c.align === "right" ? "ctTh_right" : ""} ${sortable ? "ctTh_sortable" : ""} ${active ? "ctTh_sorted" : ""}`}
                    onClick={() => {
                      if (!sortable) return;
                      const nextBy = String(c.id || "");
                      const nextDir = active ? (String(sort?.dir || "").toLowerCase() === "asc" ? "desc" : "asc") : "asc";
                      onSortChange?.({ by: nextBy, dir: nextDir });
                    }}
                    role={sortable ? "button" : undefined}
                    tabIndex={sortable ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (!sortable) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const nextBy = String(c.id || "");
                        const nextDir = active ? (String(sort?.dir || "").toLowerCase() === "asc" ? "desc" : "asc") : "asc";
                        onSortChange?.({ by: nextBy, dir: nextDir });
                      }
                    }}
                  >
                    <span className="ctThInner">
                      <span>{c.header}</span>
                      {sortable ? (
                        <span className="ctSortIco" aria-hidden="true">
                          <IconSort dir={dir} />
                        </span>
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              skelRows.map((r) => (
                <tr key={r.key} className="ctTr ctTr_skel">
                  {r.cells.map((c, idx) => (
                    <td key={idx} className={`ctTd ${idx === r.cells.length - 1 ? "ctTd_right" : ""}`}>
                      <div className="ctSkelLine" style={{ width: `${c.w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows?.length ? (
              rows.map((r) => {
                const id = String(keyFn(r));
                const active = (selectedId && String(selectedId) === id) || (kbdId && String(kbdId) === id);
                return (
                  <tr
                    key={id}
                    className={`ctTr ${active ? "ctTr_active" : ""}`}
                    aria-selected={active ? "true" : "false"}
                    onClick={() => {
                      setControlZone("table");
                      setKbdId(id);
                      onRowClick?.(r);
                    }}
                  >
                    {columns.map((c) => (
                      <td key={c.id} className={`ctTd ${c.align === "right" ? "ctTd_right" : ""}`}>
                        {c.render ? c.render(r, { initials, roleClass, statusClass }) : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="ctEmpty" colSpan={columns.length}>
                  <div>No results found</div>
                  <div className="ctEmptySub">Try adjusting your search or filter</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {pagination && !isLoading ? (
          <div className="ctFooter" role="navigation" aria-label="Pagination">
            <div className="ctFooterLeft">
              {pagination.totalItems ? (
                <span>
                  Showing <strong>{pagination.from}</strong>–<strong>{pagination.to}</strong> of <strong>{pagination.totalItems}</strong>
                </span>
              ) : (
                <span>No results</span>
              )}
            </div>

            <div className="ctPager">
              <button className="ctPagerBtn" type="button" onClick={pagination.onPrev} disabled={pagination.page <= 1} aria-label="Previous page">
                <IconChevLeft />
              </button>
              {pageButtons.map((p) => (
                <button
                  key={p}
                  className={`ctPageBtn ${Number(pagination.page) === p ? "ctPageBtn_active" : ""}`}
                  type="button"
                  onClick={() => pagination.onPage?.(p)}
                  aria-current={Number(pagination.page) === p ? "page" : undefined}
                  aria-label={`Page ${p}`}
                >
                  {p}
                </button>
              ))}
              <button className="ctPagerBtn" type="button" onClick={pagination.onNext} disabled={pagination.page >= pagination.totalPages} aria-label="Next page">
                <IconChevRight />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

