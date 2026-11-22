import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import DocumentUploadField from "../components/DocumentUploadField.jsx";
import { login, requestOtp } from "../services/authService.js";
import { registerUser } from "../services/registrationService.js";
import { saveAuth, saveAuthUser } from "../services/authStorage.js";
import { emitToast } from "../services/toastBus.js";
import { APP_DISPLAY_NAME, signInSubtitle } from "../constants/brand.js";
import { parseApiError } from "../utils/api.js";
import { otpRequestSuccessMessage } from "../utils/authUiMessages.js";
import { isCountryCodeLike, isEmailLike, isPhoneDigitsValid, normalizePhoneDigits } from "../utils/validation.js";
import { ShieldCheck, IconAuthEye, IconAuthLock, IconAuthMail, IconPlus } from "../components/ui/AppIcons.jsx";
import { InlineButtonProgress } from "../components/ui/buttons.jsx";
import "./AuthUnifiedPage.css";

/* ── Step indicator ── */
function Stepper({ step }) {
  const s = Math.max(1, Math.min(4, Number(step || 1)));
  const dots = [1, 2, 3, 4];
  return (
    <div className="stepIndicator">
      {dots.map((i, idx) => (
        <span key={i} style={{ display: "contents" }}>
          <div className={`stepDot${i === s ? " active" : i < s ? " done" : ""}`}>
            {i < s ? "✓" : i}
          </div>
          {idx < dots.length - 1 && (
            <div className={`stepLine${i < s ? " done" : ""}`} />
          )}
        </span>
      ))}
    </div>
  );
}

export default function AuthUnifiedPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(
    () => (location.pathname.includes("register") ? "register" : "login"),
    [location.pathname]
  );

  /* ── Login state ── */
  const [loginRole, setLoginRole] = useState("WHOLESALER");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRemember, setLoginRemember] = useState(false);
  const [loginPwVisible, setLoginPwVisible] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  /* ── Register state ── */
  const [regRole, setRegRole] = useState("WHOLESALER");
  const [regStep, setRegStep] = useState(1);
  const [regBusy, setRegBusy] = useState(false);
  const [regPwVisible, setRegPwVisible] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const phoneDigits = useMemo(() => normalizePhoneDigits(phoneNumber), [phoneNumber]);
  const [password, setPassword] = useState("");

  const [firmName, setFirmName] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");

  const [gstNumber, setGstNumber] = useState("");
  const [dl1Number, setDl1Number] = useState("");
  const [dl2Number, setDl2Number] = useState("");

  const [gstCertificateUrl, setGstCertificateUrl] = useState("");
  const [drugLicense1Url, setDrugLicense1Url] = useState("");
  const [drugLicense2Url, setDrugLicense2Url] = useState("");

  function onSwitchTab(tab) {
    if (tab === "login") navigate("/login");
    else navigate("/register");
  }

  function validateRegStep(step) {
    const s = Number(step || 1);
    if (s === 1) {
      if (!fullName.trim() || fullName.trim().length < 2) return "Full name must be at least 2 characters.";
      if (!isEmailLike(email)) return "Enter a valid email address.";
      if (!isCountryCodeLike(countryCode)) return "Select a valid country code.";
      if (!isPhoneDigitsValid(phoneDigits)) return "Phone number must be 7 to 15 digits.";
      if (!password || password.length < 8) return "Password must be at least 8 characters.";
    }
    if (s === 2) {
      if (!firmName.trim()) return "Firm name is required.";
      if (!/^\d{6}$/.test(String(pinCode || ""))) return "Pin code must be 6 digits.";
      if (!city.trim()) return "City is required.";
      if (!state.trim()) return "State is required.";
      if (!address.trim()) return "Address is required.";
    }
    if (s === 3) {
      if (!gstNumber.trim() || gstNumber.trim().length !== 15) return "GST number must be 15 characters.";
      if (!dl1Number.trim()) return "Drug license 1 number is required.";
      if (!dl2Number.trim()) return "Drug license 2 number is required.";
    }
    if (s === 4) {
      if (!gstCertificateUrl) return "GST certificate is required.";
      if (!drugLicense1Url) return "Drug license 1 is required.";
      if (!drugLicense2Url) return "Drug license 2 is required.";
    }
    return "";
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (loginBusy) return;
    if (!isEmailLike(loginEmail)) {
      emitToast({ type: "error", message: "Enter a valid email address (example: name@domain.com)." });
      return;
    }
    if (!loginPassword) {
      emitToast({ type: "error", message: "Password is required." });
      return;
    }
    setLoginBusy(true);
    try {
      const resp = await login({ role: loginRole, email: loginEmail, password: loginPassword, rememberMe: loginRemember });
      if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
        const t = resp.json?.data?.tokens;
        const user = resp.json?.data?.user;
        if (t?.accessToken && t?.refreshToken) {
          saveAuth({
            rememberMe: Boolean(t.rememberMe ?? loginRemember),
            email: loginEmail,
            accessToken: t.accessToken,
            accessExpiresInSec: t.accessExpiresInSec,
            refreshToken: t.refreshToken,
          });
          if (user) saveAuthUser(user);
        }
        if (Boolean(user?.must_change_password)) {
          navigate("/first-login-change-password", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else {
        const code = resp?.json?.error?.code;
        if (resp?.status === 403 && code === "EMAIL_NOT_VERIFIED") {
          const rm = loginRemember ? "1" : "0";
          navigate(
            `/verify-otp?email=${encodeURIComponent(loginEmail)}&role=${encodeURIComponent(loginRole)}&rememberMe=${rm}`,
            { replace: true }
          );
        }
      }
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleRegisterSubmit() {
    if (regBusy) return;
    const allMsg = [1, 2, 3, 4].map(validateRegStep).find(Boolean);
    if (allMsg) {
      emitToast({ type: "error", message: allMsg });
      return;
    }
    setRegBusy(true);
    try {
      const resp = await registerUser({
        role: regRole,
        fullName,
        email,
        countryCode,
        phoneNumber: phoneDigits,
        password,
        firmName,
        address,
        pinCode,
        city,
        state,
        gstNumber,
        drugLicense1Number: dl1Number,
        drugLicense2Number: dl2Number,
        gstCertificateUrl,
        drugLicense1Url,
        drugLicense2Url,
      });
      if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
        const otpResp = await requestOtp({ email, role: regRole });
        if (otpResp.status < 200 || !otpResp.json?.ok) {
          emitToast({ type: "error", message: parseApiError(otpResp) });
          return;
        }
        emitToast({ type: "success", message: otpRequestSuccessMessage(otpResp.json?.meta) });
        navigate(`/verify-otp?email=${encodeURIComponent(email)}&role=${encodeURIComponent(regRole)}`, { replace: true });
      } else {
        const fieldErrors = resp?.json?.error?.details?.fieldErrors;
        if (fieldErrors && typeof fieldErrors === "object") {
          const first = Object.values(fieldErrors).find(Boolean);
          emitToast({ type: "error", message: String(first || "Validation failed") });
        } else {
          emitToast({ type: "error", message: parseApiError(resp) });
        }
      }
    } finally {
      setRegBusy(false);
    }
  }

  function goRegStep(next) {
    const n = Math.max(1, Math.min(4, Number(next || 1)));
    if (n > regStep) {
      const msg = validateRegStep(regStep);
      if (msg) {
        emitToast({ type: "error", message: msg });
        return;
      }
    }
    setRegStep(n);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ }
  }

  const isRegister = activeTab === "register";

  return (
    <div className="authBody authPage">
      <div className={`wrapper${isRegister ? " wide" : ""}`}>
        <div className="card">

          {/* ── Card header ── */}
          <div className="card-header">
            <div className="logo-row has-tabs">
              <div className="logo-icon" aria-hidden="true">
                <IconPlus />
              </div>
              <div className="logo-name">{APP_DISPLAY_NAME}</div>
            </div>

            <div className="tabs" role="tablist" aria-label="Authentication tabs">
              <button
                className={`tab${activeTab === "login" ? " active" : ""}`}
                type="button"
                onClick={() => onSwitchTab("login")}
              >
                Sign in
              </button>
              <button
                className={`tab${activeTab === "register" ? " active" : ""}`}
                type="button"
                onClick={() => onSwitchTab("register")}
              >
                Create account
              </button>
            </div>
          </div>

          {/* ── Panels ── */}
          <div className="panels">

            {/* ── Login panel ── */}
            <div className={`panel${activeTab !== "login" ? " hidden" : ""}`} id="panel-login">
              <div className="form-title">Welcome back</div>
              <p className="form-sub">{signInSubtitle()}</p>

              <div className="roleRow" role="group" aria-label="Select role">
                <button
                  type="button"
                  className={`roleChip${loginRole === "WHOLESALER" ? " active" : ""}`}
                  onClick={() => setLoginRole("WHOLESALER")}
                >
                  Wholesaler
                </button>
                <button
                  type="button"
                  className={`roleChip${loginRole === "RETAILER" ? " active" : ""}`}
                  onClick={() => setLoginRole("RETAILER")}
                >
                  Retailer
                </button>
              </div>

              <form noValidate onSubmit={handleLoginSubmit}>
                <div className="field">
                  <label htmlFor="au-login-email">
                    Email address <span className="reqMark" aria-hidden="true">*</span>
                  </label>
                  <div className="input-wrap">
                    <IconAuthMail className="ico" />
                    <input
                      id="au-login-email"
                      name="email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="au-login-pass">
                    Password <span className="reqMark" aria-hidden="true">*</span>
                  </label>
                  <div className="input-wrap">
                    <IconAuthLock className="ico" />
                    <input
                      id="au-login-pass"
                      name="password"
                      type={loginPwVisible ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      className="eye-btn"
                      type="button"
                      onClick={() => setLoginPwVisible((v) => !v)}
                      aria-label="Toggle password visibility"
                    >
                      <IconAuthEye />
                    </button>
                  </div>
                </div>

                <div className="between-row">
                  <label className="check-label">
                    <input
                      name="rememberMe"
                      type="checkbox"
                      checked={loginRemember}
                      onChange={(e) => setLoginRemember(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <Link className="link-btn" to="/forgot-password">
                    Forgot password?
                  </Link>
                </div>

                <button className="submit-btn" type="submit" disabled={loginBusy}>
                  {loginBusy ? <InlineButtonProgress label="Signing in..." /> : "Sign in"}
                </button>
              </form>
            </div>

            {/* ── Register panel ── */}
            <div className={`panel register-panel${activeTab !== "register" ? " hidden" : ""}`} id="panel-register">

              <div className="stepBadge">
                <span className="stepDotMini" aria-hidden="true" />
                Registration
              </div>

              <div className="form-title">
                {regStep === 1
                  ? "Basic information"
                  : regStep === 2
                  ? "Business information"
                  : regStep === 3
                  ? "Legal & verification"
                  : "Upload documents"}
              </div>
              <p className="form-sub">
                {regStep === 1 ? (
                  <>Status will be <span className="pendingBadge">PENDING</span> until admin approval.</>
                ) : regStep === 2 ? (
                  "Firm details used for verification and billing."
                ) : regStep === 3 ? (
                  "These must be unique for each account."
                ) : (
                  "Upload clear photos/scans (max 5MB each)."
                )}
              </p>

              <Stepper step={regStep} />

              {/* Step 1 — Personal details */}
              {regStep === 1 && (
                <>
                  <div className="roleRow" role="group" aria-label="Select role">
                    <button
                      type="button"
                      className={`roleChip${regRole === "WHOLESALER" ? " active" : ""}`}
                      onClick={() => setRegRole("WHOLESALER")}
                    >
                      Wholesaler
                    </button>
                    <button
                      type="button"
                      className={`roleChip${regRole === "RETAILER" ? " active" : ""}`}
                      onClick={() => setRegRole("RETAILER")}
                    >
                      Retailer
                    </button>
                  </div>

                  <div className="sectionCard">
                    <div className="sectionTitle">Personal details</div>
                    <div className="sectionSub">Used to identify you and contact you.</div>

                    <div className="grid2">
                      <div className="field">
                        <label>Full name <span className="reqMark" aria-hidden="true">*</span></label>
                        <input
                          className="no-icon"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your full name"
                        />
                      </div>
                      <div className="field">
                        <label>Email <span className="reqMark" aria-hidden="true">*</span></label>
                        <input
                          className="no-icon"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label>Phone <span className="reqMark" aria-hidden="true">*</span></label>
                      <div className="phoneRow">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          aria-label="Country code"
                        >
                          <option value="+91">+91</option>
                          <option value="+1">+1</option>
                          <option value="+44">+44</option>
                          <option value="+971">+971</option>
                        </select>
                        <input
                          className="no-icon"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(normalizePhoneDigits(e.target.value))}
                          placeholder="9876543210"
                          inputMode="numeric"
                          maxLength={15}
                          autoComplete="tel-national"
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label>Password <span className="reqMark" aria-hidden="true">*</span></label>
                      <div className="input-wrap">
                        <input
                          className="no-icon"
                          type={regPwVisible ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                        />
                        <button
                          className="eye-btn"
                          type="button"
                          onClick={() => setRegPwVisible((v) => !v)}
                          aria-label="Toggle password visibility"
                        >
                          <IconAuthEye />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2 — Firm details */}
              {regStep === 2 && (
                <div className="sectionCard">
                  <div className="sectionTitle">Firm details</div>
                  <div className="sectionSub">Used for verification and billing.</div>

                  <div className="grid2">
                    <div className="field">
                      <label>Firm name <span className="reqMark" aria-hidden="true">*</span></label>
                      <input
                        className="no-icon"
                        type="text"
                        value={firmName}
                        onChange={(e) => setFirmName(e.target.value)}
                        placeholder="Firm name"
                      />
                    </div>
                    <div className="field">
                      <label>Pin code <span className="reqMark" aria-hidden="true">*</span></label>
                      <input
                        className="no-icon"
                        type="text"
                        value={pinCode}
                        onChange={(e) => setPinCode(String(e.target.value || "").replace(/\D+/g, "").slice(0, 6))}
                        placeholder="6-digit pin"
                        inputMode="numeric"
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <div className="grid2">
                    <div className="field">
                      <label>City <span className="reqMark" aria-hidden="true">*</span></label>
                      <input
                        className="no-icon"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className="field">
                      <label>State <span className="reqMark" aria-hidden="true">*</span></label>
                      <input
                        className="no-icon"
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="State"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Address <span className="reqMark" aria-hidden="true">*</span></label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Full address"
                    />
                  </div>
                </div>
              )}

              {/* Step 3 — GST & Drug Licenses */}
              {regStep === 3 && (
                <div className="sectionCard">
                  <div className="sectionTitle">GST &amp; Drug Licenses</div>
                  <div className="sectionSub">These must be unique for each account.</div>

                  <div className="field">
                    <label>GST number (15 chars) <span className="reqMark" aria-hidden="true">*</span></label>
                    <input
                      className="no-icon"
                      type="text"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      placeholder="GSTIN"
                      maxLength={15}
                    />
                  </div>

                  <div className="grid2">
                    <div className="field">
                      <label>Drug license 1 number <span className="reqMark" aria-hidden="true">*</span></label>
                      <input
                        className="no-icon"
                        type="text"
                        value={dl1Number}
                        onChange={(e) => setDl1Number(e.target.value)}
                        placeholder="DL1 number"
                      />
                    </div>
                    <div className="field">
                      <label>Drug license 2 number <span className="reqMark" aria-hidden="true">*</span></label>
                      <input
                        className="no-icon"
                        type="text"
                        value={dl2Number}
                        onChange={(e) => setDl2Number(e.target.value)}
                        placeholder="DL2 number"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4 — Documents */}
              {regStep === 4 && (
                <div className="sectionCard">
                  <div className="sectionTitle">Documents (images)</div>
                  <div className="sectionSub">Upload clear photos/scans (max 5MB each).</div>

                  <div className="docsGrid">
                    <DocumentUploadField
                      variant="box"
                      label="GST certificate"
                      docType="GST_CERTIFICATE"
                      url={gstCertificateUrl}
                      onUrlChange={setGstCertificateUrl}
                      disabled={regBusy}
                    />
                    <DocumentUploadField
                      variant="box"
                      label="Drug license 1"
                      docType="DRUG_LICENSE_1"
                      url={drugLicense1Url}
                      onUrlChange={setDrugLicense1Url}
                      disabled={regBusy}
                    />
                    <DocumentUploadField
                      variant="box"
                      label="Drug license 2"
                      docType="DRUG_LICENSE_2"
                      url={drugLicense2Url}
                      onUrlChange={setDrugLicense2Url}
                      disabled={regBusy}
                    />
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="navRow" aria-label="Registration navigation">
                <button
                  className="back-btn"
                  type="button"
                  disabled={regBusy}
                  onClick={() => (regStep === 1 ? onSwitchTab("login") : goRegStep(regStep - 1))}
                >
                  {regStep === 1 ? "← Back to sign in" : "← Back"}
                </button>

                {regStep < 4 ? (
                  <button
                    className="next-btn"
                    type="button"
                    disabled={regBusy}
                    onClick={() => goRegStep(regStep + 1)}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    className="next-btn"
                    type="button"
                    disabled={regBusy}
                    onClick={handleRegisterSubmit}
                  >
                    {regBusy ? <InlineButtonProgress label="Submitting…" /> : "Submit registration"}
                  </button>
                )}
              </div>

              <div className="bottomLink">
                Already registered?{" "}
                <Link to="/login" onClick={(e) => { e.preventDefault(); onSwitchTab("login"); }}>
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          {/* ── Card footer ── */}
          <div className="card-footer">
            <div className="secure">
              <ShieldCheck aria-hidden="true" size={12} strokeWidth={2.2} />
              Secured with 256-bit TLS encryption
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}