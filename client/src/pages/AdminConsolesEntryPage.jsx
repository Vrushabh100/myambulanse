import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GATE_HASH, sha256Hex, unlockAdmin, setAdminKey, isAdminUnlocked, getAdminKey } from "../adminGate.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export default function AdminConsolesEntryPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // If already unlocked and key verified this session, go straight to the dashboard.
    if (isAdminUnlocked() && getAdminKey()) navigate("/servicesindia/consoles/dashboard", { replace: true });
  }, [navigate]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!pw) { setError("Enter the access password."); return; }
    if (!key.trim()) { setError("Enter the admin key."); return; }
    setBusy(true);
    try {
      if (!window.crypto || !window.crypto.subtle) throw new Error("Open this page over a secure connection.");
      const h = await sha256Hex(pw);
      if (h !== GATE_HASH) throw new Error("Incorrect access password.");
      // Verify the admin key against the API before storing anything.
      const r = await fetch(`${API_BASE}/api/admin/stats`, { headers: { "x-admin-key": key } });
      if (r.status === 401) throw new Error("Wrong admin key.");
      if (r.status === 503) throw new Error("Admin access is not configured on the server.");
      if (!r.ok) throw new Error(`Could not verify admin key (${r.status}).`);
      unlockAdmin();
      setAdminKey(key);
      setPw("");
      setKey("");
      navigate("/servicesindia/consoles/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-wrap">
      <div className="card admin-card">
        <h2>Admin Consoles</h2>
        <div className="notice danger">Owner-only. Never share this page, the password, or the admin key.</div>
        <form onSubmit={submit}>
          <label>Access password</label>
          <input type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter password" />
          <label>Admin key</label>
          <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="x-admin-key" />
          <button className="btn primary wide" disabled={busy}>{busy ? "Verifying..." : "Enter consoles"}</button>
        </form>
        {error && <div className="error">{error}</div>}
        <Link className="skip-link" to="/auth/login">Back to login</Link>
      </div>
    </div>
  );
}
