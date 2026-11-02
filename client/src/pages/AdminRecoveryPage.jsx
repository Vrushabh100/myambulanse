import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const MOBILE_RE = /^[6-9]\d{9}$/;

export default function AdminRecoveryPage() {
  const [key, setKey] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  async function lookup(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!key.trim()) { setError("Enter the admin key."); return; }
    if (!MOBILE_RE.test(mobile)) { setError("Enter a valid 10-digit mobile number."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/user/${mobile}`, { headers: { "x-admin-key": key } });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error("Wrong admin key.");
      if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
      setResult(data);
      setSecondsLeft(60);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally { setBusy(false); }
  }

  function clearAll() { setResult(null); setKey(""); setMobile(""); setSecondsLeft(0); setError(""); }

  return (
    <div className="admin-wrap">
      <div className="card admin-card">
        <h2>Owner recovery console</h2>
        <div className="notice danger">
          Owner-only. Never share this page or the admin key. Read the default MPIN only to the verified account owner on the customer-care call.
        </div>
        <form onSubmit={lookup}>
          <label>Admin key</label>
          <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="x-admin-key" />
          <label>User mobile number</label>
          <input inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile" />
          <button className="btn primary wide" disabled={busy}>{busy ? "Looking up..." : "Look up default MPIN"}</button>
        </form>
        {error && <div className="error">{error}</div>}
        {result && (
          <div>
            <div className="notice">
              {result.name || "—"} · {result.role || "—"} · {result.mpinBlocked ? "BLOCKED" : "active"}
            </div>
            <div className="admin-hint">Default MPIN (tell the verified owner only):</div>
            <div className="admin-secret">{secondsLeft > 0 ? result.defaultMpin : "••••••"}</div>
            <div className="admin-hint">{secondsLeft > 0 ? `Hidden in ${secondsLeft}s` : "Hidden — look up again to view."}</div>
            <button type="button" className="btn ghost" onClick={clearAll}>Clear</button>
          </div>
        )}
        <Link className="skip-link" to="/auth/login">Back to login</Link>
      </div>
    </div>
  );
}