import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../services/authService.js";
import { emitToast } from "../services/toastBus.js";
import { parseApiError } from "../utils/api.js";
import { isEmailLike } from "../utils/validation.js";
import { saveAuth, saveAuthUser } from "../services/authStorage.js";
import { APP_DISPLAY_NAME } from "../constants/brand.js";
import { IconAuthEye, IconAuthLock, IconAuthMail, IconBrandMark, IconSecure } from "../components/ui/AppIcons.jsx";
import "../styles/auth.css";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [pwVisible, setPwVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="authBody authPage">
      <div className="wrapper">
        <div className="card">
          <div className="card-header">
            <div className="logo-row">
              <div className="logo-icon" aria-hidden="true">
                <IconBrandMark />
              </div>
              <div className="logo-name">{APP_DISPLAY_NAME}</div>
            </div>
          </div>

          <div className="panel">
            <div className="form-title">Admin sign in</div>
            <p className="form-sub">Sign in to your {APP_DISPLAY_NAME} admin console</p>

            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);

                const form = e.currentTarget;
                const email = form.email?.value || "";
                const password = form.password?.value || "";

                if (!isEmailLike(email)) {
                  emitToast({ type: "error", message: "Enter a valid email address." });
                  setBusy(false);
                  return;
                }
                if (!password) {
                  emitToast({ type: "error", message: "Password is required." });
                  setBusy(false);
                  return;
                }

                const resp = await adminLogin({ email, password });
                if (resp.status >= 200 && resp.status < 300 && resp.json?.ok) {
                  const t = resp.json?.data?.tokens;
                  const user = resp.json?.data?.user;
                  if (t?.accessToken && t?.refreshToken) {
                    saveAuth({
                      rememberMe: false,
                      email,
                      accessToken: t.accessToken,
                      accessExpiresInSec: t.accessExpiresInSec,
                      refreshToken: t.refreshToken
                    });
                    if (user) saveAuthUser(user);
                  }
                  navigate("/dashboard", { replace: true });
                } else {
                  emitToast({ type: "error", message: parseApiError(resp) });
                }

                setBusy(false);
              }}
            >
              <div className="field">
                <label>Email address</label>
                <div className="input-wrap">
                  <IconAuthMail />
                  <input name="email" type="email" placeholder="admin@chainopharma.com" required />
                </div>
              </div>

              <div className="field">
                <label>Password</label>
                <div className="input-wrap">
                  <IconAuthLock />
                  <input
                    name="password"
                    type={pwVisible ? "text" : "password"}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button className="eye-btn" type="button" onClick={() => setPwVisible((v) => !v)} aria-label="Toggle password visibility">
                    <IconAuthEye />
                  </button>
                </div>
              </div>

              <button className="submit-btn" type="submit">
                {busy ? "Signing in..." : "Sign in"}
              </button>
            </form>

          </div>

          <div className="card-footer">
            <div className="secure">
              <IconSecure />
              Admin access is protected
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

