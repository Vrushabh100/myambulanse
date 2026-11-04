import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { isAdminUnlocked, lockAdmin, getAdminKey } from "../adminGate.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

async function adminFetch(path, key, method = "GET", body) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-admin-key": key },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Wrong admin key.");
  if (res.status === 503) throw new Error("Admin access is not configured.");
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function statusBadge(s) {
  if (s === "approved") return "badge ok";
  if (s === "suspended") return "badge warn";
  if (s === "banned" || s === "declined") return "badge danger";
  return "badge";
}

export default function AdminDoctorsPage() {
  const [key, setKey] = useState(getAdminKey() || "");
  const [tab, setTab] = useState("pending");
  const [pending, setPending] = useState(null);
  const [approved, setApproved] = useState(null);
  const [openId, setOpenId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    if (isAdminUnlocked() && getAdminKey()) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAdminUnlocked()) return <Navigate to="/servicesindia/consoles" replace />;

  async function load() {
    if (!key.trim()) { setError("Enter the admin key."); return; }
    setError(""); setFlash(""); setBusy(true);
    try {
      const [p, a] = await Promise.all([
        adminFetch("/admin/doctors/pending", key),
        adminFetch("/admin/doctors/approved", key)
      ]);
      setPending(Array.isArray(p) ? p : []);
      setApproved(Array.isArray(a) ? a : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(id, action, body, label) {
    setError(""); setFlash("");
    try {
      await adminFetch(`/admin/doctors/${id}/${action}`, key, "POST", body || {});
      setFlash(label);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const approve = (d) => act(d.id, "approve", {}, `Approved ${d.name}`);
  const unsuspend = (d) => act(d.id, "unsuspend", {}, `Unsuspended ${d.name}`);
  function decline(d) {
    const note = window.prompt("Reason for declining (optional):", "");
    if (note == null) return;
    act(d.id, "decline", { note }, `Declined ${d.name}`);
  }
  function suspend(d) {
    const months = window.prompt("Suspend for how many months? (1-24)", "1");
    if (months == null) return;
    act(d.id, "suspend", { months: parseInt(months, 10) || 1 }, `Suspended ${d.name}`);
  }
  function ban(d) {
    const note = window.prompt("Reason for ban (optional):", "");
    if (note == null) return;
    act(d.id, "ban", { note }, `Banned ${d.name}`);
  }
  function warn(d) {
    const note = window.prompt("Warning note (required):", "");
    if (note == null) return;
    if (!note.trim()) { setError("A warning note is required."); return; }
    act(d.id, "warn", { note }, `Warned ${d.name}`);
  }

  function details(d) {
    return (
      <div className="kv" style={{ marginTop: 8 }}>
        <div><b>{d.name}</b> · {d.mobile} · <span className={statusBadge(d.approvalStatus)}>{d.approvalStatus}</span></div>
        {d.degree ? <div className="muted small">Degree: {d.degree}</div> : null}
        {d.specialization ? <div className="muted small">Specialization: {d.specialization}</div> : null}
        {d.clinicAddress ? <div className="muted small">Clinic: {d.clinicAddress}</div> : null}
        {d.address ? <div className="muted small">Address: {d.address}</div> : null}
        {d.approvalNote ? <div className="muted small">Note: {d.approvalNote}</div> : null}
        {d.suspendUntil ? <div className="muted small">Suspended until: {new Date(d.suspendUntil).toLocaleString()}</div> : null}
        {Array.isArray(d.warnings) && d.warnings.length > 0 ? (
          <div className="muted small">
            Warnings:
            {d.warnings.map((w, i) => (
              <div key={i}>⚠ {w.note} <span className="muted">({new Date(w.at).toLocaleDateString()})</span></div>
            ))}
          </div>
        ) : null}
        {d.createdAt ? <div className="muted small">Registered: {new Date(d.createdAt).toLocaleString()}</div> : null}
        {d.lastLoginAt ? <div className="muted small">Last login: {new Date(d.lastLoginAt).toLocaleString()}</div> : null}
      </div>
    );
  }

  function row(d, kind) {
    const open = openId === String(d.id);
    return (
      <div key={d.id} className="list-item static" style={{ display: "block" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="linkish" onClick={() => setOpenId(open ? "" : String(d.id))}><b>{d.name}</b></button>
          <span className="muted small">{d.mobile}</span>
          <span className={statusBadge(d.approvalStatus)}>{d.approvalStatus}</span>
          {d.specialization ? <span className="muted small">· {d.specialization}</span> : null}
        </div>
        {open ? details(d) : null}
        <div className="row-actions" style={{ marginTop: 8 }}>
          {kind === "pending" ? (
            <>
              <button type="button" className="btn primary small-btn" disabled={busy} onClick={() => approve(d)}>Approve</button>
              <button type="button" className="btn ghost small-btn" disabled={busy} onClick={() => setOpenId(open ? "" : String(d.id))}>Review</button>
              <button type="button" className="btn danger small-btn" disabled={busy} onClick={() => decline(d)}>Decline</button>
            </>
          ) : (
            <>
              <button type="button" className="btn warn small-btn" disabled={busy} onClick={() => suspend(d)}>Suspend</button>
              {d.approvalStatus === "suspended" ? (
                <button type="button" className="btn primary small-btn" disabled={busy} onClick={() => unsuspend(d)}>Unsuspend</button>
              ) : null}
              <button type="button" className="btn danger small-btn" disabled={busy} onClick={() => ban(d)}>Ban</button>
              <button type="button" className="btn ghost small-btn" disabled={busy} onClick={() => warn(d)}>Warn</button>
            </>
          )}
        </div>
      </div>
    );
  }

  const list = tab === "pending" ? pending : approved;

  return (
    <div className="admin-wrap">
      <div className="card admin-card">
        <h2>Doctor Registration Console</h2>
        <div className="notice danger">Owner-only. Never share this page or the admin key.</div>

        <label>Admin key</label>
        <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="x-admin-key" />
        <button className="btn primary wide" disabled={busy} onClick={load}>{busy ? "Loading..." : "Load doctors"}</button>

        <div className="seg wide-seg" style={{ marginTop: 14 }}>
          <button type="button" className={tab === "pending" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("pending")}>
            Upcoming{pending ? ` (${pending.length})` : ""}
          </button>
          <button type="button" className={tab === "approved" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("approved")}>
            Approved{approved ? ` (${approved.length})` : ""}
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {flash ? <div className="notice">{flash}</div> : null}

        {list === null ? (
          <p className="hint">Enter the admin key and press "Load doctors".</p>
        ) : list.length === 0 ? (
          <p className="hint">{tab === "pending" ? "No upcoming applications." : "No approved doctors yet."}</p>
        ) : (
          <div className="list">{list.map((d) => row(d, tab))}</div>
        )}

        <div className="row-actions" style={{ marginTop: 12 }}>
          <Link className="skip-link" to="/servicesindia/consoles/dashboard">← Admin dashboard</Link>
          <button type="button" className="btn ghost small-btn" onClick={() => { lockAdmin(); window.location.href = "/servicesindia/consoles"; }}>Lock</button>
        </div>
      </div>
    </div>
  );
}