import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { isAdminUnlocked, getAdminKey, lockAdmin } from "../adminGate.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

async function adminFetch(path, key) {
  const res = await fetch(`${API_BASE}/api${path}`, { headers: { "x-admin-key": key } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Wrong admin key.");
  if (res.status === 503) throw new Error("Admin access is not configured.");
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function AdminConsoleDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const key = getAdminKey();

  useEffect(() => {
    if (!isAdminUnlocked() || !key) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const [s, u] = await Promise.all([adminFetch("/admin/stats", key), adminFetch("/admin/users", key)]);
        if (cancelled) return;
        setStats(s);
        setUsers(Array.isArray(u) ? u : []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!isAdminUnlocked() || !key) return <Navigate to="/servicesindia/consoles" replace />;

  function doLock() { lockAdmin(); navigate("/servicesindia/consoles", { replace: true }); }

  const filtered = (users || []).filter((u) => {
    if (tab === "all") return true;
    if (tab === "patients") return u.role === "patient";
    if (tab === "doctors") return u.role === "doctor";
    if (tab === "pending") return u.role === "doctor" && u.approvalStatus === "pending";
    return true;
  });

  return (
    <div className="admin-wrap" style={{ maxWidth: 960 }}>
      <div className="card admin-card">
        <h2>Admin Dashboard</h2>
        <div className="notice danger">Owner-only. Never share this page or the admin key.</div>

        {error && <div className="error">{error}</div>}
        {busy && !stats && <p className="hint">Loading dashboard…</p>}

        {stats && (
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="display-stat"><b>{stats.users}</b><span>Total accounts</span></div>
            <div className="display-stat"><b>{stats.patients}</b><span>Patients</span></div>
            <div className="display-stat"><b>{stats.doctors.total}</b><span>Doctors</span></div>
            <div className="display-stat"><b>{stats.doctors.pending}</b><span>Doctors pending</span></div>
            <div className="display-stat"><b>{stats.doctors.suspended + stats.doctors.banned}</b><span>Suspended / Banned</span></div>
            <div className="display-stat"><b>{stats.emergencies.total}</b><span>Total SOS</span></div>
            <div className="display-stat"><b>{stats.emergencies.active}</b><span>Active SOS</span></div>
            <div className="display-stat"><b>{stats.emergencies.resolved}</b><span>Resolved SOS</span></div>
          </div>
        )}

        <h3>Consoles</h3>
        <div className="chip-row" style={{ marginBottom: 16 }}>
          <Link className="chip" to="/servicesindia/consoles/dashboard/doctors">🩺 Doctors console</Link>
          <Link className="chip" to="/servicesindia/consoles/dashboard/recovery">🔑 Recovery console</Link>
        </div>

        <h3>Registered accounts</h3>
        <div className="seg wide-seg" style={{ marginBottom: 10 }}>
          <button type="button" className={tab === "all" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("all")}>All</button>
          <button type="button" className={tab === "patients" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("patients")}>Patients</button>
          <button type="button" className={tab === "doctors" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("doctors")}>Doctors</button>
          <button type="button" className={tab === "pending" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("pending")}>Pending</button>
        </div>

        {users === null ? (
          <p className="hint">Loading accounts…</p>
        ) : filtered.length === 0 ? (
          <p className="hint">No accounts in this view.</p>
        ) : (
          <div className="list">
            {filtered.map((u) => (
              <div key={u.id} className="list-item static" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <b>{u.name}</b> <span className="muted small">· {u.mobile}</span>
                  <div className="muted small">
                    {u.role}
                    {u.role === "doctor" ? ` · ${u.approvalStatus}` : ""}
                    {u.address ? ` · ${u.address}` : ""}
                  </div>
                </div>
                <div className="muted small" style={{ textAlign: "right" }}>
                  <div>Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                  {u.lastLoginAt ? <div>Last login {new Date(u.lastLoginAt).toLocaleDateString()}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="row-actions" style={{ marginTop: 14 }}>
          <Link className="skip-link" to="/servicesindia/consoles/dashboard/recovery">Owner recovery console</Link>
          <button type="button" className="btn ghost small-btn" onClick={doLock}>Lock</button>
        </div>
      </div>
    </div>
  );
}