import { useEffect, useMemo, useRef, useState } from "react";
import "./UserDetailPanel.css";

const ICON = {
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Block: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Link: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  ChevDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
};

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

function roleStyle(role) {
  const raw = String(role || "").trim();
  const r = raw
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z_]/g, "")
    .toUpperCase();
  const map = {
    WHOLESALER: { cls: "udpRole_wholesaler", label: "WHOLESALER" },
    RETAILER: { cls: "udpRole_retailer", label: "RETAILER" },
    ADMIN: { cls: "udpRole_admin", label: "ADMIN" },
    PHARMACIST: { cls: "udpRole_pharmacist", label: "PHARMACIST" }
  };
  return map[r] || { cls: "udpRole_unknown", label: raw ? raw.toUpperCase() : "-" };
}

function fmtStatus(status) {
  const s = String(status || "").toUpperCase();
  if (!s) return "-";
  return s[0] + s.slice(1).toLowerCase();
}

function fmtDateTime(value) {
  if (!value) return "-";
  const s = String(value || "").trim();
  if (!s) return "-";
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return s;
  const d = new Date(ms);
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function buildDraftFromUser(user) {
  if (!user) return null;
  return {
    full_name: String(user.full_name || user.name || "").trim(),
    email: String(user.email || "").trim(),
    phone_country_code: String(user.phone_country_code || "").trim(),
    phone_number: String(user.phone_number || "").trim(),
    firm_name: String(user.firm_name || "").trim(),
    address: String(user.address || "").trim(),
    city: String(user.city || "").trim(),
    state: String(user.state || "").trim(),
    pin_code: String(user.pin_code || user.pinCode || "").trim(),
    gst_number: String(user.gst_number || user.gstNumber || "").trim(),
    drug_license_1_number: String(user.drug_license_1_number || "").trim(),
    drug_license_2_number: String(user.drug_license_2_number || "").trim(),
    gst_certificate_url: String(user.gst_certificate_url || "").trim(),
    drug_license_1_url: String(user.drug_license_1_url || "").trim(),
    drug_license_2_url: String(user.drug_license_2_url || "").trim()
  };
}

export default function UserDetailPanel({
  open,
  user,
  readOnly = false,
  busy = false,
  onClose,
  onStatusChange,
  onSaveUser,
  onBlockToggle
}) {
  const [status, setStatus] = useState(String(user?.status || "PENDING").toUpperCase());
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    setStatus(String(user?.status || "PENDING").toUpperCase());
  }, [user?.status]);

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setDraft(null);
    }
  }, [open]);

  useEffect(() => {
    setEditing(false);
    setDraft(null);
  }, [user?.id]);

  useEffect(() => {
    function onKey(e) {
      if (!open) return;
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ui = useMemo(() => {
    if (!user) return null;
    const name = user.full_name || user.name || "-";
    const email = user.email || "-";
    const phone = user.phone || user.phone_number || "-";
    const createdAt = fmtDateTime(user.createdAt || user.created_at || "");
    const address = user.address || "";
    const city = user.city || "";
    const state = user.state || "";
    const pinCode = user.pin_code || user.pinCode || "";
    const firmName = user.firm_name || user.firmName || "";
    const gstNumber = user.gst_number || user.gstNumber || "";
    const gstCertificateUrl = user.gst_certificate_url || user.gstCertificateUrl || "";
    const isBlocked = Boolean(user.isBlocked ?? user.is_blocked);
    const emailVerified = Boolean(user.emailVerified ?? user.email_verified);
    const role = String(user.role || "").trim() || "-";

    return {
      id: user.id,
      name,
      email,
      phone,
      createdAt,
      address,
      city,
      state,
      pinCode,
      firmName,
      gstNumber,
      gstCertificateUrl,
      isBlocked,
      emailVerified,
      role,
      drugLicense1Number: user.drugLicense1Number || user.drug_license_1_number || "",
      drugLicense1Url: user.drugLicense1Url || user.drug_license_1_url || "",
      drugLicense2Number: user.drugLicense2Number || user.drug_license_2_number || "",
      drugLicense2Url: user.drugLicense2Url || user.drug_license_2_url || ""
    };
  }, [user]);

  if (!open) return null;

  const copyEmail = async () => {
    const email = ui?.email || "";
    if (!email || email === "-") return;
    try {
      await navigator.clipboard?.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const r = roleStyle(ui?.role);

  const loadLocked = busy || !user || String(user.full_name || "").startsWith("Loading");
  const canEdit = Boolean(onSaveUser) && !loadLocked && !readOnly;

  async function handleSave() {
    if (!ui?.id || !draft || !onSaveUser) return;
    setSaveBusy(true);
    const payload = {
      full_name: draft.full_name.trim(),
      email: draft.email.trim(),
      phone_country_code: draft.phone_country_code.trim(),
      phone_number: draft.phone_number.trim(),
      firm_name: draft.firm_name.trim() || null,
      address: draft.address.trim() || null,
      city: draft.city.trim() || null,
      state: draft.state.trim() || null,
      pin_code: draft.pin_code.trim() || null,
      gst_number: draft.gst_number.trim() || null,
      drug_license_1_number: draft.drug_license_1_number.trim() || null,
      drug_license_2_number: draft.drug_license_2_number.trim() || null,
      gst_certificate_url: draft.gst_certificate_url.trim() || null,
      drug_license_1_url: draft.drug_license_1_url.trim() || null,
      drug_license_2_url: draft.drug_license_2_url.trim() || null
    };
    const ok = await onSaveUser(ui.id, payload);
    setSaveBusy(false);
    if (ok) setEditing(false);
  }

  function startEdit() {
    setDraft(buildDraftFromUser(user));
    setEditing(true);
  }

  return (
    <div className="udpRoot" aria-hidden={!open}>
      <button className="udpOverlay" type="button" onClick={onClose} aria-label="Close details" />

      <aside className="udpPanel" ref={panelRef} aria-label="User detail panel">
        <div className="udpHeader">
          <h2 className="udpTitle">User Details</h2>
          <div className="udpHeaderRight">
            <button className="udpCloseBtn" type="button" onClick={onClose} title="Close panel" aria-label="Close panel">
              <ICON.Close />
            </button>
          </div>
        </div>

        <div className="udpHero">
          <div className="udpAvatar" aria-hidden="true">
            {initials(ui?.name || "")}
          </div>
          <div className="udpHeroInfo">
            <div className="udpHeroName">{ui?.name || "-"}</div>
            <div className="udpHeroEmailRow">
              <span className="udpHeroEmail">{ui?.email || "-"}</span>
              <button className={`udpCopyBtn ${copied ? "udpCopyBtn_ok" : ""}`} type="button" onClick={copyEmail} title="Copy email" aria-label="Copy email">
                <ICON.Copy />
              </button>
            </div>
            <div className="udpBadgeRow">
              <span className={`udpRole ${r.cls}`}>{r.label}</span>
              <span className={`udpChip ${ui?.emailVerified ? "udpChip_ok" : "udpChip_bad"}`}>
                {ui?.emailVerified ? "Verified" : "Unverified"}
              </span>
            </div>
          </div>
        </div>

        {editing ? <div className="udpHint">Edit the fields below, then click Save changes. Use Block / Unblock for access control.</div> : null}

        <div className="udpSection">
          <div className="udpSectionTitle">Contact & Identity</div>
          <div className="udpGrid">
            <div className="udpCell udpCell_full">
              <div className="udpLabel">Full Name</div>
              {editing && draft ? (
                <input
                  className="udpInput"
                  value={draft.full_name}
                  onChange={(e) => setDraft((d) => (d ? { ...d, full_name: e.target.value } : d))}
                  autoComplete="name"
                />
              ) : (
                <div className="udpValue">{ui?.name || "-"}</div>
              )}
            </div>
            <div className="udpCell udpCell_full">
              <div className="udpLabel">Email Address</div>
              {editing && draft ? (
                <input
                  className="udpInput"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                  autoComplete="email"
                />
              ) : (
                <div className="udpValue">{ui?.email || "-"}</div>
              )}
            </div>
            <div className="udpCell udpCell_full">
              <div className="udpLabel">Phone</div>
              {editing && draft ? (
                <div className="udpInputRow">
                  <input
                    className="udpInput"
                    value={draft.phone_country_code}
                    onChange={(e) => setDraft((d) => (d ? { ...d, phone_country_code: e.target.value } : d))}
                    placeholder="+91"
                    aria-label="Country code"
                  />
                  <input
                    className="udpInput"
                    value={draft.phone_number}
                    onChange={(e) => setDraft((d) => (d ? { ...d, phone_number: e.target.value } : d))}
                    inputMode="tel"
                    aria-label="Phone number"
                  />
                </div>
              ) : (
                <div className="udpValue">{ui?.phone || "-"}</div>
              )}
            </div>
            <div className="udpCell">
              <div className="udpLabel">Created At</div>
              <div className="udpValue">{String(ui?.createdAt || "-").toString().slice(0, 32) || "-"}</div>
            </div>
          </div>
        </div>

        {editing || ui?.firmName || ui?.gstNumber || ui?.gstCertificateUrl ? (
          <div className="udpSection">
            <div className="udpSectionTitle">Business</div>
            <div className="udpGrid">
              <div className="udpCell udpCell_full">
                <div className="udpLabel">Business Name</div>
                {editing && draft ? (
                  <input
                    className="udpInput"
                    value={draft.firm_name}
                    onChange={(e) => setDraft((d) => (d ? { ...d, firm_name: e.target.value } : d))}
                  />
                ) : (
                  <div className="udpValue">{ui?.firmName || "-"}</div>
                )}
              </div>
              <div className="udpCell udpCell_full">
                <div className="udpLabel">GST Number</div>
                {editing && draft ? (
                  <input
                    className="udpInput"
                    value={draft.gst_number}
                    onChange={(e) => setDraft((d) => (d ? { ...d, gst_number: e.target.value } : d))}
                  />
                ) : (
                  <div className="udpValue">{ui?.gstNumber || "-"}</div>
                )}
              </div>
            </div>

            {editing && draft ? (
              <div className="udpGrid" style={{ marginTop: 10 }}>
                <div className="udpCell udpCell_full">
                  <div className="udpLabel">GST certificate URL</div>
                  <input
                    className="udpInput"
                    value={draft.gst_certificate_url}
                    onChange={(e) => setDraft((d) => (d ? { ...d, gst_certificate_url: e.target.value } : d))}
                    placeholder="https://…"
                  />
                </div>
              </div>
            ) : ui?.gstCertificateUrl ? (
              <div style={{ marginTop: 10 }}>
                <div className="udpLicenseCard">
                  <div className="udpLicenseLabel">GST Certificate</div>
                  <div className="udpLicenseNum">Document</div>
                  <a className="udpLicenseLink" href={ui.gstCertificateUrl} target="_blank" rel="noreferrer">
                    <span className="udpLinkIco" aria-hidden="true">
                      <ICON.Link />
                    </span>
                    View document
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {editing || ui?.address || ui?.city ? (
          <div className="udpSection">
            <div className="udpSectionTitle">Location</div>
            <div className="udpGrid">
              <div className="udpCell udpCell_full">
                <div className="udpLabel">Address</div>
                {editing && draft ? (
                  <textarea
                    className="udpTextarea"
                    value={draft.address}
                    onChange={(e) => setDraft((d) => (d ? { ...d, address: e.target.value } : d))}
                    rows={3}
                  />
                ) : ui?.address ? (
                  <div className="udpValue">{ui.address}</div>
                ) : (
                  <div className="udpValue">-</div>
                )}
              </div>
              <div className="udpCell">
                <div className="udpLabel">City</div>
                {editing && draft ? (
                  <input className="udpInput" value={draft.city} onChange={(e) => setDraft((d) => (d ? { ...d, city: e.target.value } : d))} />
                ) : (
                  <div className="udpValue">{ui?.city || "-"}</div>
                )}
              </div>
              <div className="udpCell">
                <div className="udpLabel">State</div>
                {editing && draft ? (
                  <input className="udpInput" value={draft.state} onChange={(e) => setDraft((d) => (d ? { ...d, state: e.target.value } : d))} />
                ) : (
                  <div className="udpValue">{ui?.state || "-"}</div>
                )}
              </div>
              <div className="udpCell">
                <div className="udpLabel">Pin Code</div>
                {editing && draft ? (
                  <input className="udpInput" value={draft.pin_code} onChange={(e) => setDraft((d) => (d ? { ...d, pin_code: e.target.value } : d))} />
                ) : (
                  <div className="udpValue">{ui?.pinCode || "-"}</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="udpSection">
          <div className="udpSectionTitle">Account Status</div>
          <div className="udpGrid">
            <div className="udpCell">
              <div className="udpLabel">Approval</div>
              <div className="udpSelectWrap">
                <select
                  className="udpSelect"
                  value={status}
                  disabled={readOnly || editing}
                  onChange={(e) => {
                    const next = String(e.target.value || "").toUpperCase();
                    setStatus(next);
                    onStatusChange?.(ui?.id, next);
                  }}
                >
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <span className="udpSelectChev" aria-hidden="true">
                  <ICON.ChevDown />
                </span>
              </div>
            </div>
            <div className="udpCell">
              <div className="udpLabel">Blocked?</div>
              <div className="udpValue">
                <span className={`udpChip ${ui?.isBlocked ? "udpChip_bad" : "udpChip_ok"}`}>{ui?.isBlocked ? "Blocked" : "Active"}</span>
              </div>
            </div>
            <div className="udpCell">
              <div className="udpLabel">System role</div>
              <div className="udpValue" title="System role cannot be changed from the admin panel.">
                <span className={`udpRole ${r.cls}`}>{r.label}</span>
              </div>
            </div>
            <div className="udpCell">
              <div className="udpLabel">Email</div>
              <div className="udpValue">
                <span className={`udpChip ${ui?.emailVerified ? "udpChip_ok" : "udpChip_bad"}`}>{ui?.emailVerified ? "Verified" : "Not verified"}</span>
              </div>
            </div>
          </div>
        </div>

        {editing || ui?.drugLicense1Number || ui?.drugLicense2Number ? (
          <div className="udpSection">
            <div className="udpSectionTitle">Drug Licenses</div>
            {editing && draft ? (
              <>
                <div className="udpLicenseCard">
                  <div className="udpLicenseLabel">License 1</div>
                  <input
                    className="udpInput"
                    style={{ marginBottom: 8 }}
                    value={draft.drug_license_1_number}
                    onChange={(e) => setDraft((d) => (d ? { ...d, drug_license_1_number: e.target.value } : d))}
                    placeholder="Number"
                  />
                  <input
                    className="udpInput"
                    value={draft.drug_license_1_url}
                    onChange={(e) => setDraft((d) => (d ? { ...d, drug_license_1_url: e.target.value } : d))}
                    placeholder="Document URL"
                  />
                </div>
                <div className="udpLicenseCard">
                  <div className="udpLicenseLabel">License 2</div>
                  <input
                    className="udpInput"
                    style={{ marginBottom: 8 }}
                    value={draft.drug_license_2_number}
                    onChange={(e) => setDraft((d) => (d ? { ...d, drug_license_2_number: e.target.value } : d))}
                    placeholder="Number"
                  />
                  <input
                    className="udpInput"
                    value={draft.drug_license_2_url}
                    onChange={(e) => setDraft((d) => (d ? { ...d, drug_license_2_url: e.target.value } : d))}
                    placeholder="Document URL"
                  />
                </div>
              </>
            ) : (
              <>
                {ui?.drugLicense1Number ? (
                  <div className="udpLicenseCard">
                    <div className="udpLicenseLabel">License 1</div>
                    <div className="udpLicenseNum">{ui.drugLicense1Number}</div>
                    {ui?.drugLicense1Url ? (
                      <a className="udpLicenseLink" href={ui.drugLicense1Url} target="_blank" rel="noreferrer">
                        <span className="udpLinkIco" aria-hidden="true">
                          <ICON.Link />
                        </span>
                        View document
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {ui?.drugLicense2Number ? (
                  <div className="udpLicenseCard">
                    <div className="udpLicenseLabel">License 2</div>
                    <div className="udpLicenseNum">{ui.drugLicense2Number}</div>
                    {ui?.drugLicense2Url ? (
                      <a className="udpLicenseLink" href={ui.drugLicense2Url} target="_blank" rel="noreferrer">
                        <span className="udpLinkIco" aria-hidden="true">
                          <ICON.Link />
                        </span>
                        View document
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {!readOnly ? (
          <div className="udpActionBar">
            {editing ? (
              <>
                <button
                  className="udpBtnGhost"
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                  }}
                  disabled={saveBusy || busy}
                >
                  Cancel
                </button>
                <button className="udpBtnPrimary" type="button" onClick={() => void handleSave()} disabled={saveBusy || busy || !draft}>
                  {saveBusy ? "Saving…" : "Save changes"}
                </button>
              </>
            ) : (
              <>
                <button className="udpBtnPrimary" type="button" onClick={startEdit} disabled={!canEdit}>
                  <span className="udpBtnIco" aria-hidden="true">
                    <ICON.Edit />
                  </span>
                  Edit User
                </button>
                <button
                  className="udpBtnDanger"
                  type="button"
                  onClick={() => onBlockToggle?.(ui?.id)}
                  disabled={!onBlockToggle || loadLocked || busy}
                >
                  <span className="udpBtnIco" aria-hidden="true">
                    <ICON.Block />
                  </span>
                  {ui?.isBlocked ? "Unblock" : "Block"}
                </button>
              </>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

