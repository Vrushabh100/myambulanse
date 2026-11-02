import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

const MOBILE_RE = /^[6-9]\d{9}$/;

export default function ForgotMpinPage() {
  const [mobile, setMobile] = useState("");
  const [step, setStep] = useState("mobile");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { if (lockSeconds <= 0) return; const t = setInterval(() => setLockSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000); return () => clearInterval(t); }, [lockSeconds]);
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  function handleErr(err) {
    if (err.status === 429) { setLockSeconds(err.lockSeconds || 60); setError(err.message); }
    else if (err.status === 423) { setBlocked(true); setError(err.message); }
    else setError(err.message || "Something went wrong.");
  }

  async function start(e) {
    e.preventDefault();
    setError("");
    if (!MOBILE_RE.test(mobile)) { setError("Enter a valid 10-digit mobile number."); return; }
    setBusy(true);
    try {
      const data = await api("/auth/mpin/forgot/start", { method: "POST", body: { mobile } });
      if (data.blocked) { setBlocked(true); setError("For safety, answer attempts are disabled. Please call customer care."); }
      else { setQuestion(data.question || ""); setStep("answer"); }
    } catch (err) { handleErr(err); } finally { setBusy(false); }
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    if (answer.trim().length < 1) { setError("Enter your answer."); return; }
    setBusy(true);
    try {
      const data = await api("/auth/mpin/forgot/verify", { method: "POST", body: { mobile, answer } });
      sessionStorage.setItem("ma_reset_token", data.resetToken);
      navigate("/login/mpin/setmpin", { replace: true });
    } catch (err) { handleErr(err); } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2>Forgot MPIN</h2>
        <div className="notice">Need help? Call MyAmbulance customer care <a className="cc-link" href="tel:+918007470450">+91 8007470450</a>.</div>
        {blocked && <div className="notice danger">Your answer input is disabled for safety. Please call customer care for account recovery.</div>}
        {lockSeconds > 0 && <div className="lock-note">Too many attempts. Try again in {mmss(lockSeconds)}. <a className="cc-link" href="tel:+918007470450">Call +91 8007470450</a></div>}
        {error && !blocked && lockSeconds === 0 && <div className="error">{error}</div>}

        {step === "mobile" && (
          <form onSubmit={start}>
            <label>Mobile number</label>
            <input required inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile" />
            <button className="btn primary wide" disabled={busy || lockSeconds > 0 || blocked}>{busy ? "Please wait..." : "Continue"}</button>
          </form>
        )}

        {step === "answer" && (
          <form onSubmit={verify}>
            <div className="forgot-q">{question || "Answer your security question"}</div>
            <p className="hint">Capital letters, spaces and punctuation don't matter.</p>
            <label>Your answer</label>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer" disabled={blocked || lockSeconds > 0} />
            <button className="btn primary wide" disabled={busy || lockSeconds > 0 || blocked}>{busy ? "Please wait..." : "Verify answer"}</button>
          </form>
        )}

        <button type="button" className="auth-switch" onClick={() => navigate("/auth/login")}>Back to login</button>
      </div>
    </div>
  );
}