import { useEffect, useMemo, useState } from "react";
import { listUsers, getUserDetails, updateUser, updateUserStatus, deleteUser } from "../services/adminUsersService.js";
import { listRoles } from "../services/adminRolesService.js";
import { readAuth } from "../services/authStorage.js";
import AppShell from "../layouts/AppShell.jsx";
import { APP_DOCUMENT_TITLE } from "../constants/brand.js";
import CommonTable from "../components/CommonTable.jsx";
import UserDetailPanel from "../components/UserDetailPanel.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import "./UsersPage.css";

function fmtPhone(u) {
  const cc = u?.phone_country_code || "";
  const pn = u?.phone_number || "";
  const s = `${cc} ${pn}`.trim();
  return s || "-";
}

function roleLabel(r) {
  const v = String(r || "").toUpperCase();
  return v || "-";
}

function isAccountOwner(u) {
  if (u?.is_account_owner === true || u?.is_account_owner === "true") return true;
  if (u?.is_account_owner === false || u?.is_account_owner === "false") return false;
  return true;
}

export default function UsersPage() {
  const auth = readAuth();
  const email = auth?.user?.email || auth?.email || "";
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("");
  const [blockedFilter, setBlockedFilter] = useState("");
  const [roles, setRoles] = useState([{ value: "", label: "All roles" }]);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: "", name: "" });
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  const query = useMemo(
    () => ({ search, role, statusFilter, userTypeFilter, blockedFilter, sortBy, sortDir, page }),
    [search, role, statusFilter, userTypeFilter, blockedFilter, sortBy, sortDir, page]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const resp = await listRoles();
      if (!alive) return;
      if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
        const list = resp.json?.data?.roles || [];
        setRoles([
          { value: "", label: "All roles" },
          ...list.map((r) => ({ value: String(r.id), label: r.name || r.code || `Role ${r.id}` }))
        ]);
      } else {
        // keep default options
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    // Enter loading state immediately (prevents "No results" flash during debounce).
    setBusy(true);
    const t = window.setTimeout(async () => {
      const offset = (Math.max(1, page) - 1) * pageSize;
      const resp = await listUsers({
        search: query.search,
        role: query.role,
        status: query.statusFilter,
        userType: query.userTypeFilter,
        blocked: query.blockedFilter,
        sortBy: query.sortBy || undefined,
        sortDir: query.sortBy ? query.sortDir : undefined,
        limit: pageSize,
        offset
      });
      if (!alive) return;
      if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
        setRows(resp.json?.data?.users || []);
        setTotal(resp.json?.data?.total || 0);
      } else {
        // Errors are auto-toasted by apiClient (avoid duplicate toasts here).
      }
      setBusy(false);
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(t);
      // If a new query starts immediately, it will set busy=true again.
      setBusy(false);
    };
  }, [query]);

  const openDetails = async (id) => {
    setSelectedId(id);
    setDrawerOpen(true);
    setDetails(null);
    setDrawerBusy(true);
    const resp = await getUserDetails(id);
    if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
      const user = resp.json?.data?.user || null;
      setDetails(user);
    } else {
      // Errors are auto-toasted by apiClient (avoid duplicate toasts here).
      setDrawerOpen(false);
    }
    setDrawerBusy(false);
  };

  const handleSaveUser = async (userId, payload) => {
    if (!userId || !payload) return false;
    setDrawerBusy(true);
    const resp = await updateUser(userId, payload);
    if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
      const refreshed = await getUserDetails(userId);
      if (refreshed.status >= 200 && refreshed.status < 300 && refreshed.json?.ok) {
        const u = refreshed.json?.data?.user || null;
        if (u) setDetails(u);
        setRows((prev) =>
          prev.map((row) =>
            row.id === userId
              ? {
                  ...row,
                  full_name: u?.full_name ?? row.full_name,
                  email: u?.email ?? row.email,
                  phone_country_code: u?.phone_country_code ?? row.phone_country_code,
                  phone_number: u?.phone_number ?? row.phone_number,
                  role: u?.role ?? row.role,
                  status: u?.status ?? row.status,
                  is_blocked: u?.is_blocked ?? row.is_blocked
                }
              : row
          )
        );
      }
      setDrawerBusy(false);
      return true;
    }
    setDrawerBusy(false);
    return false;
  };

  const handleBlockToggle = async (userId) => {
    if (!userId || !details) return;
    const next = !details.is_blocked;
    setDrawerBusy(true);
    const resp = await updateUser(userId, { is_blocked: next });
    if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
      setDetails((d) => (d && String(d.id) === String(userId) ? { ...d, is_blocked: next } : d));
      setRows((prev) => prev.map((row) => (row.id === userId ? { ...row, is_blocked: next } : row)));
    }
    setDrawerBusy(false);
  };

  const handleStatusChange = async (userId, newStatus) => {
    if (!userId) return;
    const nextStatus = String(newStatus || "").toUpperCase();
    if (!nextStatus || nextStatus === "BLOCKED") return;
    setDrawerBusy(true);
    const resp = await updateUserStatus(userId, nextStatus);
    if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
      setDetails((d) => (d && String(d.id) === String(userId) ? { ...d, status: nextStatus } : d));
      setRows((prev) => prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)));
    } else {
      // Errors are auto-toasted by apiClient (avoid duplicate toasts here).
    }
    setDrawerBusy(false);
  };

  const IconEye = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  const IconEdit = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
  const IconTrash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 16h10l1-16" />
    </svg>
  );

  const columns = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      render: (u, h) => {
        const owner = isAccountOwner(u);
        const parentName = String(u.parent_name || "").trim();
        const parentEmail = String(u.parent_email || "").trim();
        return (
          <div className="ctNameCell">
            <div className="ctAvatar" aria-hidden="true">
              {h.initials(u.full_name || u.email || "U")}
            </div>
            <div className="usersNameBlock">
              <div className="ctNameRow">
                <span className="ctNameText">{u.full_name || "-"}</span>
                {!owner ? <span className="usersKindBadge">Sub-user</span> : <span className="usersKindBadge usersKindBadge_owner">Account owner</span>}
              </div>
              {!owner && parentName ? (
                <div className="usersParentLine" title={`Parent account · ${parentEmail || ""}`}>
                  Parent: <strong>{parentName}</strong>
                  {parentEmail ? <span className="usersParentEmail"> · {parentEmail}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      }
    },
    {
      id: "email",
      header: "Email",
      sortable: true,
      render: (u) => <span style={{ color: "var(--color-text-3)" }}>{u.email || "-"}</span>
    },
    {
      id: "role",
      header: "Role",
      sortable: true,
      render: (u, h) => {
        const sys = roleLabel(u.role);
        const custom = String(u.custom_role_name || "").trim();
        return (
          <div className="usersRoleCell">
            <span className={`ctRolePill ${h.roleClass(u.role)}`}>{sys}</span>
            {custom ? (
              <span className="usersCustomRolePill" title="Custom role (assigned by account owner)">
                {custom}
              </span>
            ) : null}
          </div>
        );
      }
    },
    {
      id: "phone",
      header: "Phone",
      sortable: true,
      render: (u) => <span style={{ color: "var(--color-text-3)", fontVariantNumeric: "tabular-nums" }}>{fmtPhone(u)}</span>
    },
    {
      id: "joined",
      header: "Joined",
      sortable: true,
      render: (u) => (
        <span style={{ color: "var(--color-text-3)", fontVariantNumeric: "tabular-nums" }}>{String(u.created_at || "-").slice(0, 10)}</span>
      )
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      render: (u, h) => (
        <span className={`ctStatus ${h.statusClass(u.status)}`}>
          <span className="ctDot" aria-hidden="true" />
          {String(u.status || "-")
            .toLowerCase()
            .replace(/^\w/, (c) => c.toUpperCase())}
        </span>
      )
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      sortable: false,
      render: (u) => (
        <div className="ctActions" onClick={(e) => e.stopPropagation()}>
          <button className="ctIconBtn" type="button" title="View" onClick={() => openDetails(u.id)}>
            <IconEye />
          </button>
          <button className="ctIconBtn" type="button" title="Edit" onClick={() => openDetails(u.id)}>
            <IconEdit />
          </button>
          <button
            className="ctIconBtn"
            type="button"
            title="Delete"
            onClick={async () => {
              setConfirm({ open: true, id: u.id, name: u.full_name || u.email || "" });
            }}
          >
            <IconTrash />
          </button>
        </div>
      )
    }
  ];

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  return (
    <AppShell title={APP_DOCUMENT_TITLE} userName={auth?.user?.full_name || email || "Admin"} userEmail={email} variant="admin">
      <div className="usersPage">
        <div className="usersCard">
          <CommonTable
            title="Users"
            subtitle="Search and manage registered users."
            countText={busy ? "Loading…" : `${total || 0} users`}
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            filters={[
              {
                id: "role",
                label: "System role",
                ariaLabel: "Filter by system role",
                value: role,
                onChange: (v) => {
                  setRole(v);
                  setPage(1);
                },
                options: roles
              },
              {
                id: "status",
                label: "Status",
                ariaLabel: "Filter by approval status",
                value: statusFilter,
                onChange: (v) => {
                  setStatusFilter(v);
                  setPage(1);
                },
                options: [
                  { value: "", label: "All statuses" },
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REJECTED", label: "Rejected" }
                ]
              },
              {
                id: "userType",
                label: "Account type",
                ariaLabel: "Filter by account owner or sub-user",
                value: userTypeFilter,
                onChange: (v) => {
                  setUserTypeFilter(v);
                  setPage(1);
                },
                options: [
                  { value: "", label: "All users" },
                  { value: "owner", label: "Account owners" },
                  { value: "sub", label: "Sub-users" }
                ]
              },
              {
                id: "blocked",
                label: "Blocked",
                ariaLabel: "Filter by blocked state",
                value: blockedFilter,
                onChange: (v) => {
                  setBlockedFilter(v);
                  setPage(1);
                },
                options: [
                  { value: "", label: "All" },
                  { value: "true", label: "Blocked" },
                  { value: "false", label: "Not blocked" }
                ]
              }
            ]}
            sort={{ by: sortBy, dir: sortDir }}
            onSortChange={({ by, dir }) => {
              setSortBy(String(by || ""));
              setSortDir(String(dir || "").toLowerCase() === "asc" ? "asc" : "desc");
              setPage(1);
            }}
            rows={rows}
            selectedId={selectedId}
            getRowId={(u) => u.id}
            onRowClick={(u) => openDetails(u.id)}
            onRowDelete={(u) => setConfirm({ open: true, id: u.id, name: u.full_name || u.email || "" })}
            columns={columns}
            pagination={{
              page,
              totalPages,
              totalItems: total || 0,
              from: total ? (page - 1) * pageSize + 1 : 0,
              to: total ? Math.min(page * pageSize, total) : 0,
              onPrev: () => setPage((p) => Math.max(1, p - 1)),
              onNext: () => setPage((p) => Math.min(totalPages, p + 1)),
              onPage: (p) => setPage(p)
            }}
          />
        </div>

        <UserDetailPanel
          open={drawerOpen}
          busy={drawerBusy}
          user={
            drawerBusy
              ? { id: selectedId, full_name: "Loading…", email: "", role: "", status: "PENDING", is_blocked: false, email_verified: false }
              : details
                ? { ...details, phone: fmtPhone(details) }
                : null
          }
          onClose={() => setDrawerOpen(false)}
          onStatusChange={handleStatusChange}
          onSaveUser={handleSaveUser}
          onBlockToggle={handleBlockToggle}
        />

        <ConfirmDialog
          open={confirm.open}
          title="Delete user?"
          message={confirm.name ? `Delete ${confirm.name}?` : "Delete this user?"}
          hint="This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
          busy={drawerBusy}
          onClose={() => setConfirm({ open: false, id: "", name: "" })}
          onConfirm={async () => {
            if (!confirm.id) return;
            setDrawerBusy(true);
            const resp = await deleteUser(confirm.id);
            if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
              setRows((prev) => prev.filter((x) => x.id !== confirm.id));
              setTotal((t) => Math.max(0, t - 1));
              if (String(details?.id || "") === String(confirm.id)) {
                setDrawerOpen(false);
                setSelectedId("");
                setDetails(null);
              }
              setConfirm({ open: false, id: "", name: "" });
            } else {
              // Errors are auto-toasted by apiClient (avoid duplicate toasts here).
            }
            setDrawerBusy(false);
          }}
        />
      </div>
    </AppShell>
  );
}

