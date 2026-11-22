import { useCallback, useEffect, useState } from "react";
import { readAuth } from "../services/authStorage.js";
import AppShell from "../layouts/AppShell.jsx";
import { APP_DOCUMENT_TITLE } from "../constants/brand.js";
import { getNoticeBar, saveNoticeBar } from "../services/noticeBarService.js";
import "./NoticeBarPage.css";

export default function NoticeBarPage() {
  const auth = readAuth();
  const email = auth?.user?.email || auth?.email || "";

  const [busy, setBusy] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#e0f2fe");
  const [textColor, setTextColor] = useState("#0c4a6e");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");

  const loadNotice = useCallback(async () => {
    const resp = await getNoticeBar({ toast: "none" });
    if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
      const a = resp.json?.data?.announcement;
      if (!a) return;
      setEnabled(Boolean(a.enabled));
      setMessageText(String(a.messageText || ""));
      setBackgroundColor(String(a.backgroundColor || "#e0f2fe"));
      setTextColor(String(a.textColor || "#0c4a6e"));
      setButtonLabel(String(a.buttonLabel || ""));
      setButtonUrl(String(a.buttonUrl || ""));
    }
  }, []);

  useEffect(() => {
    loadNotice();
  }, [loadNotice]);

  return (
    <AppShell title={APP_DOCUMENT_TITLE} userName={auth?.user?.full_name || email || "Admin"} userEmail={email} variant="admin">
      <div className="nbPage">
        <div className="nbTop">
          <div>
            <div className="nbTitle">Notice bar</div>
            <div className="nbSub">
              One banner for the whole platform. It appears below the header in the <strong>user app</strong> for <strong>all</strong> signed-in users (every
              account and sub-user).
            </div>
          </div>
        </div>

        <div className="nbCard">
          <label className="nbCheck">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={busy} />
            <span>Show notice bar</span>
          </label>

          <div className="nbField nbFull">
            <label>Message (HTML allowed)</label>
            <textarea
              className="nbTextarea"
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={busy}
              placeholder={'e.g. <p>Maintenance tonight <strong>10 PM–11 PM</strong>.</p> or plain text.'}
            />
            <div className="nbHint">Use tags like &lt;p&gt;, &lt;strong&gt;, &lt;br&gt;, &lt;a href=&quot;…&quot;&gt;, &lt;ul&gt;/&lt;li&gt;. Scripts and unsafe markup are removed on the user app.</div>
          </div>

          <div className="nbField">
            <label>Background colour</label>
            <div className="nbColorRow">
              <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} disabled={busy} />
              <input className="nbInput" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} disabled={busy} />
            </div>
          </div>

          <div className="nbField">
            <label>Text colour</label>
            <div className="nbColorRow">
              <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} disabled={busy} />
              <input className="nbInput" value={textColor} onChange={(e) => setTextColor(e.target.value)} disabled={busy} />
            </div>
          </div>

          <div className="nbField">
            <label>Button label (optional)</label>
            <input className="nbInput" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} disabled={busy} placeholder="e.g. Learn more" />
          </div>

          <div className="nbField nbFull">
            <label>Button link (optional)</label>
            <input className="nbInput" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} disabled={busy} placeholder="https://… or /internal-path" />
          </div>

          <div className="nbFooter">
            <button
              className="nbBtnPrimary"
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await saveNoticeBar({
                    enabled,
                    messageText,
                    backgroundColor,
                    textColor,
                    buttonLabel: buttonLabel.trim(),
                    buttonUrl: buttonUrl.trim()
                  });
                  await loadNotice();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
