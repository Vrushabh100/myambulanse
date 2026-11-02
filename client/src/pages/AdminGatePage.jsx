import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GATE_HASH, sha256Hex, unlockAdmin } from "../adminGate.js";

export default function AdminGatePage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!pw) { setError("Enter the access password."); return; }
    setBusy(true);
    try {
      if (!window.crypto || !window.crypto.subtle) throw new Error("This page must be opened over a secure connection.");
      const h = await sha256Hex(pw);
      if (h !== GATE_HASH) throw new Error("Incorrect password.");
      unlockAdmin();
      setPw("");
      navigate("/servicesindia/recovery", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <div className="admin-wrap">
      <div className="card admin-card">
        <h2>Service Access</h2>
        <div className="notice">Restricted area. Enter the access password to continue.</div>
        <form onSubmit={submit}>
          <label>Access password</label>
          <input type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter password" />
          <button className="btn primary wide" disabled={busy}>{busy ? "Checking..." : "Continue"}</button>
        </form>
        {error && <div className="error">{error}</div>}
        <Link className="skip-link" to="/auth/login">Back to login</Link>
      </div>
    </div>
  );
}