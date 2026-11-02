import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setSession, saveMobile, getSavedMobile, saveDeviceToken, setRecovery } from "../../api.js";
import MpinInput from "../../components/MpinInput.jsx";
import { MOBILE_RE } from "../../mpinRules.js";

export default function LoginForm({ onLogin }) {
  const [mobile, setMobile] = useState(getSavedMobile());
  const [mpin, setMpin] = useState("");
  const [step, setStep] = useState(MOBILE_RE.test(getSavedMobile()) ? "mpin" : "mobile");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { if (lockSeconds <= 0) return; const t = setInterval(() => setLockSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000); return () => clearInterval(t); }, [lockSeconds]);
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (step === "mobile") {
      if (!MOBILE_RE.test(mobile)) { setError("Enter a valid 10-digit mobile number."); return; }
      setStep("mpin");
      return;
    }
    if (!MOBILE_RE.test(mobile)) { setError("Enter a valid 10-digit mobile number."); return; }
    if (!/^\d{6}$/.test(mpin)) { setError("MPIN must be exactly 6 digits."); return; }
    setBusy(true);
    try {
      const data = await api("/auth/login", { method: "POST", body: { mobile, mpin } });
      setSession(data.token, data.user);
      saveMobile(mobile);
      if (data.deviceToken) saveDeviceToken(data.deviceToken);
      if (data.recovery) { setRecovery(true); onLogin(data.user); navigate("/login/mpin/setmpin?recovery=1", { replace: true }); }
      else { setRecovery(false); onLogin(data.user); navigate("/", { replace: true }); }
    } catch (err) {
      if (err.status === 429) { setLockSeconds(err.lockSeconds || 60); setError(err.message); }
      else if (err.status === 423) { setBlocked(true); setError(err.message); }
      else { if (err.status === 401) setMpin(""); setError(err.message || "Something went wrong."); }
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      {step === "mobile" ? (
        <>
          <label>Mobile number</label>
          <input required inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile" />
        </>
      ) : (
        <>
          <div className="hint">{mobile} · <button type="button" className="auth-switch" style={{ display: "inline", padding: 0, margin: 0 }} onClick={() => setStep("mobile")}>Change</button></div>
          <label>MPIN</label>
          <MpinInput value={mpin} onChange={setMpin} disabled={busy} autoFocus />
        </>
      )}

      {error && <div className="error">{error}</div>}
      {lockSeconds > 0 && (<div className="lock-note">Too many attempts. Try again in {mmss(lockSeconds)}. <a className="cc-link" href="tel:+918007470450">Call +91 8007470450</a></div>)}
      {blocked && (<div className="notice danger">Your account is locked. Call <a className="cc-link" href="tel:+918007470450">+91 8007470450</a> and enter the default MPIN they give you above.</div>)}

      <button className="btn primary wide" disabled={busy || lockSeconds > 0}>{busy ? "Please wait..." : step === "mobile" ? "Continue" : "Login"}</button>
      {step === "mpin" && (<button type="button" className="auth-switch" onClick={() => navigate("/login/mpin/forgotmpin")}>Forgot MPIN?</button>)}
      <button type="button" className="auth-switch" onClick={() => navigate("/auth/register")}>Don't have an account — Register</button>
    </form>
  );
}