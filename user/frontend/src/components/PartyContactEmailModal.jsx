import CommonModal from "./CommonModal.jsx";
import { InlineButtonProgress } from "./ui/buttons.jsx";
import { IconEmail } from "./TableActionKit.jsx";
import { IconMessageChannelDeco } from "./TableActionKit.jsx";

/**
 * Shared “add email (and optional phone) then retry send” dialog used for invoice / ledger emails.
 */
export default function PartyContactEmailModal({
  open,
  title = "Contact for email",
  icon = <IconEmail />,
  partySubtitle: _partySubtitle,
  email,
  phone,
  phoneCountryCode,
  onEmailChange,
  onPhoneChange,
  onPhoneCountryChange,
  showPhoneFields = true,
  canSave,
  saving,
  onClose,
  onSave,
  saveLabel = "Save & send",
  footerHint: _footerHint,
  permissionWarning
}) {
  return (
    <CommonModal
      open={open}
      title={title}
      icon={icon}
      onClose={() => {
        if (saving) return;
        onClose?.();
      }}
      size="sm"
      footer={
        <div className="sfmModalFooter">
          <button className="sfmBtnGhost" type="button" onClick={() => (saving ? null : onClose?.())} disabled={saving}>
            Close
          </button>
          <button className="sfmBtnPrimary" type="button" disabled={saving || !canSave} onClick={onSave}>
            {saving ? <InlineButtonProgress label="Saving…" /> : saveLabel}
          </button>
        </div>
      }
    >
      <div className="sfm">
        {permissionWarning ? <div className="psErr">{permissionWarning}</div> : null}
        <div className="raField">
          <label>
            Email <span className="reqMark" aria-hidden="true">*</span>
          </label>
          <input
            className="raInput"
            type="email"
            value={email}
            onChange={(e) => onEmailChange?.(e.target.value)}
            placeholder="party@email.com"
            autoComplete="email"
          />
        </div>
        {showPhoneFields ? (
          <div className="raField">
            <label>Phone</label>
            <div className="sbmPhoneRow">
              <select
                className="raInput"
                value={phoneCountryCode || "+91"}
                onChange={(e) => onPhoneCountryChange?.(e.target.value)}
                aria-label="Phone country"
              >
                <option value="+91">+91</option>
                <option value="+1">+1</option>
                <option value="+44">+44</option>
              </select>
              <input
                className="raInput"
                type="tel"
                value={phone}
                onChange={(e) => onPhoneChange?.(e.target.value)}
                placeholder="10 digit mobile (optional for email)"
                autoComplete="tel"
              />
            </div>
          </div>
        ) : null}
        <div className="sbmChDeco" aria-hidden="true">
          <span className="sbmChDecoIcon">
            <IconMessageChannelDeco />
          </span>
          <span className="sbmChDecoText">In-app and instant channels can appear here in a later release.</span>
        </div>
      </div>
    </CommonModal>
  );
}
