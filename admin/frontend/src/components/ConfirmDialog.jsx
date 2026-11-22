import CommonModal from "./CommonModal.jsx";
import { IconAlert } from "./ui/AppIcons.jsx";
import "./ConfirmDialog.css";

export default function ConfirmDialog({
  open,
  title = "Confirm action",
  message = "Are you sure?",
  hint = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  busy = false,
  onConfirm,
  onClose
}) {
  return (
    <CommonModal
      open={open}
      title={title}
      subtitle=""
      ariaLabel={title}
      size="sm"
      onClose={() => (busy ? null : onClose?.())}
      closeOnOverlay={!busy}
      footer={
        <div className="cdFooter">
          <button className="cdBtnGhost" type="button" data-cm-cancel="true" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`cdBtn ${danger ? "cdBtn_danger" : ""}`}
            type="button"
            data-cm-primary="true"
            disabled={busy}
            onClick={async () => {
              await onConfirm?.();
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="cdBody">
        <div className={`cdIco ${danger ? "cdIco_danger" : ""}`} aria-hidden="true">
          <IconAlert />
        </div>
        <div className="cdText">
          <div className="cdMsg">{message}</div>
          {hint ? <div className="cdHint">{hint}</div> : null}
        </div>
      </div>
    </CommonModal>
  );
}

