import { InlineButtonProgress } from "./ui/buttons.jsx";
import { useEffect, useMemo, useState } from "react";
import CommonModal from "./CommonModal.jsx";
import PhoneInput from "./PhoneInput.jsx";
import "./StructuredForm.css";
import { IconUser } from "./ui/AppIcons.jsx";
function clean(v) {
  return String(v ?? "").trim();
}

export default function AccountUserModal({
  open,
  mode, // "create" | "edit"
  busy,
  canSubmit = true,
  roles = [],
  initialValues,
  onClose,
  onSubmit
}) {
  const isEdit = mode === "edit";
  const entityLabel = "User";

  const empty = useMemo(
    () => ({
      fullName: "",
      email: "",
      phoneCountryCode: "+91",
      phoneNumber: "",
      customRoleId: ""
    }),
    []
  );

  const [form, setForm] = useState(empty);
  const [touched, setTouched] = useState({ phoneCc: false, phone: false, name: false, email: false, role: false });

  useEffect(() => {
    if (!open) return;
    const v = initialValues || {};
    setForm({
      fullName: v.fullName ?? v.full_name ?? "",
      email: v.email ?? "",
      phoneCountryCode: v.phoneCountryCode ?? v.phone_country_code ?? "+91",
      phoneNumber: v.phoneNumber ?? v.phone_number ?? "",
      customRoleId: v.customRoleId ?? v.custom_role_id ?? ""
    });
    setTouched({ phoneCc: false, phone: false, name: false, email: false, role: false });
  }, [open, initialValues, empty]);

  const phoneCcOk = /^\+\d{1,4}$/.test(clean(form.phoneCountryCode));
  const phoneDigits = clean(form.phoneNumber).replace(/\D+/g, "");
  const phoneOk = /^\d{7,15}$/.test(phoneDigits);
  const nameOk = clean(form.fullName).length >= 2;
  const emailOk = isEdit ? true : Boolean(clean(form.email));
  const roleOk = Boolean(String(form.customRoleId || "").trim());

  const canSave = canSubmit && !busy && nameOk && phoneCcOk && phoneOk && emailOk && roleOk;

  return (
    <CommonModal
      open={open}
      title={isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
      subtitle=""
      icon={<IconUser />}
      onClose={() => (busy ? null : onClose?.())}
      size="md"
      footer={
        <div className="uupModalFooter sfmModalFooter">
          <button className="uupBtnGhost sfmBtnGhost" type="button" data-cm-cancel="true" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            className="uupBtn sfmBtnPrimary"
            type="button"
            data-cm-primary="true"
            disabled={!canSave}
            onClick={async () => {
              await onSubmit?.({
                fullName: clean(form.fullName),
                email: clean(form.email),
                phoneCountryCode: clean(form.phoneCountryCode),
                phoneNumber: phoneDigits,
                customRoleId: String(form.customRoleId || "")
              });
            }}
          >
            {busy ? (
              <InlineButtonProgress label="Saving…" />
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create user"
            )}
          </button>
        </div>
      }
    >
      <div className="sfm">
        <div className="sfmSection">
          <div className="sfmSectionHead">
            <div className="sfmTitle">Profile</div>
          </div>
          <div className="sfmGrid">
            <div className="raField">
              <label>Full name <span className="reqMark" aria-hidden="true">*</span></label>
              <input
                className="raInput"
                value={form.fullName}
                onChange={(e) => {
                  setTouched((t) => ({ ...t, name: true }));
                  setForm((p) => ({ ...p, fullName: e.target.value }));
                }}
                placeholder="e.g., Aman Sharma"
                autoComplete="name"
              />
            </div>

            <div className="raField">
              <label>Email{isEdit ? null : <> <span className="reqMark" aria-hidden="true">*</span></>}</label>
              <input
                className="raInput"
                value={form.email}
                disabled={isEdit}
                onChange={(e) => {
                  setTouched((t) => ({ ...t, email: true }));
                  setForm((p) => ({ ...p, email: e.target.value }));
                }}
                placeholder="e.g., aman@company.com"
                autoComplete="email"
              />
            </div>

            <div className="sfmFull">
              <PhoneInput
                compact
                countryCode={form.phoneCountryCode}
                phoneNumber={form.phoneNumber}
                onCountryCodeChange={(v) => {
                  setTouched((t) => ({ ...t, phoneCc: true }));
                  setForm((p) => ({ ...p, phoneCountryCode: v }));
                }}
                onPhoneNumberChange={(v) => {
                  setTouched((t) => ({ ...t, phone: true }));
                  setForm((p) => ({ ...p, phoneNumber: v }));
                }}
                countryCodeError={!touched.phoneCc ? "" : phoneCcOk ? "" : "Use format like +91"}
                phoneNumberError={!touched.phone ? "" : phoneOk ? "" : "Enter 7–15 digits"}
              />
            </div>
          </div>
        </div>

        <div className="sfmSection">
          <div className="sfmSectionHead">
            <div className="sfmTitle">Access</div>
          </div>
          <div className="sfmGrid">
            <div className="raField sfmFull">
              <label>Role <span className="reqMark" aria-hidden="true">*</span></label>
              <select
                className="raInput"
                value={form.customRoleId}
                onChange={(e) => {
                  setTouched((t) => ({ ...t, role: true }));
                  setForm((p) => ({ ...p, customRoleId: e.target.value }));
                }}
              >
                <option value="" disabled>
                  Select a role
                </option>
                {(roles || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </CommonModal>
  );
}

