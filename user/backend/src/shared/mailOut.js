/**
 * Outbound email via SMTP (env).
 *
 * Gmail requires an App Password when 2-Step Verification is on:
 *   SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_SECURE=0
 *   SMTP_USER=you@gmail.com  SMTP_PASS=16-char-app-password
 *   SMTP_FROM="Chaino Pharma <you@gmail.com>"
 *
 * MEDICO_EMAIL_DRY_RUN=1 → do not open SMTP (local/tests).
 * SMTP_ETHEREAL_FALLBACK=1 → if Gmail auth fails, send via Ethereal test inbox and log preview URL.
 */
let transporter;
let etherealTransporter;

function isSmtpConfigured() {
  return Boolean(String(process.env.SMTP_HOST || "").trim() && String(process.env.SMTP_FROM || "").trim());
}
function isDryRun() {
  const v = String(process.env.MEDICO_EMAIL_DRY_RUN || "").toLowerCase();
  return v === "1" || v === "true";
}
function etherealFallbackEnabled() {
  const v = String(process.env.SMTP_ETHEREAL_FALLBACK || "").toLowerCase();
  return v === "1" || v === "true";
}

function getTransporter() {
  if (transporter) return transporter;
  const host = String(process.env.SMTP_HOST || "").trim();
  if (!host) return null;
  // eslint-disable-next-line global-require
  const nodemailer = require("nodemailer");
  const port = Number.parseInt(String(process.env.SMTP_PORT || "587"), 10) || 587;
  const secure = String(process.env.SMTP_SECURE || "0") === "1" || port === 465;
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "");
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user
      ? {
          auth: { user, pass }
        }
      : {})
  });
  return transporter;
}

function friendlySmtpError(err) {
  const msg = String(err?.message || err || "Send failed");
  if (/Invalid login|BadCredentials|535/i.test(msg)) {
    return "Email login failed. Gmail needs an App Password (Google Account → Security → App passwords). The normal Gmail password will not work for sending mail.";
  }
  return msg;
}

async function sendViaEthereal(p) {
  // eslint-disable-next-line global-require
  const nodemailer = require("nodemailer");
  if (!etherealTransporter) {
    const account = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass }
    });
    // eslint-disable-next-line no-console
    console.warn("[medico:mail] Ethereal fallback account:", account.user);
  }
  const from = String(process.env.SMTP_FROM || "Chaino Pharma <noreply@chainopharma.test>").trim();
  const info = await etherealTransporter.sendMail({
    from,
    to: p.to,
    subject: p.subject,
    text: p.text || undefined,
    html: p.html || undefined,
    attachments: p.attachments && p.attachments.length ? p.attachments : undefined
  });
  const preview = nodemailer.getTestMessageUrl(info);
  // eslint-disable-next-line no-console
  console.warn("[medico:mail] Ethereal preview URL:", preview || "(none)");
  return { ok: true, dryRun: false, ethereal: true, previewUrl: preview || null };
}

/** Send outbound mail; optional `attachments` like nodemailer (filename, content Buffer, contentType). */
async function sendMail(p) {
  const to = String(p.to || "").trim();
  const subject = String(p.subject || "").trim();
  if (!to || !subject) return { ok: false, dryRun: false, error: "Missing to or subject" };

  const attachMeta = Array.isArray(p.attachments)
    ? p.attachments.map((a) => ({
        filename: a.filename || "attachment",
        bytes: Buffer.isBuffer(a.content) ? a.content.length : typeof a.content === "string" ? a.content.length : 0
      }))
    : [];

  if (isDryRun()) {
    // eslint-disable-next-line no-console
    console.log("[medico:mail] dry run  would send:", { to, subject, htmlLen: (p.html || "").length, attachments: attachMeta });
    return { ok: true, dryRun: true };
  }
  if (!isSmtpConfigured()) {
    // eslint-disable-next-line no-console
    console.log("[medico:mail] SMTP not set  would send (no message delivered):", {
      to,
      subject,
      htmlLen: (p.html || "").length,
      attachments: attachMeta
    });
    return { ok: true, dryRun: true };
  }

  const t = getTransporter();
  if (!t) return { ok: false, dryRun: false, error: "SMTP not configured" };
  const from = String(process.env.SMTP_FROM || "").trim();
  try {
    await t.sendMail({
      from,
      to,
      subject,
      text: p.text || undefined,
      html: p.html || undefined,
      attachments: p.attachments && p.attachments.length ? p.attachments : undefined
    });
    return { ok: true, dryRun: false };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[medico:mail] send failed", e?.message || e);
    if (etherealFallbackEnabled()) {
      try {
        return await sendViaEthereal(p);
      } catch (e2) {
        // eslint-disable-next-line no-console
        console.error("[medico:mail] ethereal fallback failed", e2?.message || e2);
      }
    }
    return { ok: false, dryRun: false, error: friendlySmtpError(e) };
  }
}

module.exports = { sendMail, isSmtpConfigured, isDryRun };
