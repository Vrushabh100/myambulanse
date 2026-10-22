import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const EMPTY = {
  registrationNo: "",
  ownerName: "",
  vehicleModel: "",
  color: "",
  device1: "",
  device2: ""
};

export default function VehiclesPage({ user }) {
  const [vehicles, setVehicles] = useState([]);
  const [patients, setPatients] = useState([]);
  const [tab, setTab] = useState("track");
  const [form, setForm] = useState({ ...EMPTY, ownerName: user.name });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    try {
      setVehicles(await api("/vehicles"));
      setPatients(await api("/patients"));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function registerCar(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/vehicles", {
        method: "POST",
        body: {
          registrationNo: form.registrationNo,
          ownerName: form.ownerName,
          vehicleModel: form.vehicleModel,
          color: form.color,
          devices: [
            { deviceId: form.device1, label: "Siren + Lights kit" },
            { deviceId: form.device2, label: "Beep + Navigation kit" }
          ]
        }
      });
      setForm({ ...EMPTY, ownerName: user.name });
      await load();
      setTab("track");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openVehicle(v) {
    try {
      setSelected(await api(`/vehicles/${v._id}`));
    } catch {
      setSelected(v);
    }
  }

  async function assignPatient(patientId) {
    try {
      const updated = await api(`/vehicles/${selected._id}`, { method: "PUT", body: { assignedPatientId: patientId } });
      setSelected(updated);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeVehicle(id) {
    if (!confirm("Remove this car?")) return;
    try {
      await api(`/vehicles/${id}`, { method: "DELETE" });
      if (selected?._id === id) setSelected(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="eyebrow">Emergency Vehicles</div>
      <div className="seg wide-seg">
        <button className={tab === "track" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("track")}>
          Track Car
        </button>
        <button className={tab === "register" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("register")}>
          + Register New Car
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      {tab === "register" && (
        <form className="card form-2col" onSubmit={registerCar}>
          <h2>Register Emergency Vehicle</h2>
          <div>
            <label>Car registration number *</label>
            <input
              required
              value={form.registrationNo}
              onChange={set("registrationNo")}
              placeholder="e.g. MH12AB1234"
              style={{ textTransform: "uppercase" }}
            />
            <label>Car owner name *</label>
            <input required value={form.ownerName} onChange={set("ownerName")} placeholder="Owner name" />
            <label>Car model</label>
            <input value={form.vehicleModel} onChange={set("vehicleModel")} placeholder="e.g. Maruti Swift" />
            <label>Color</label>
            <input value={form.color} onChange={set("color")} placeholder="e.g. White" />
          </div>
          <div>
            <h3 className="sub">Emergency Device Kit (2 devices)</h3>
            <label>Device 1 ID * (siren + red/blue lights)</label>
            <input required value={form.device1} onChange={set("device1")} placeholder="e.g. DEV-A1001" />
            <label>Device 2 ID * (beep + navigation)</label>
            <input required value={form.device2} onChange={set("device2")} placeholder="e.g. DEV-B2002" />
            <p className="hint">
              The kit contains 2 hardware devices: one drives the siren + red/blue lights, the other
              the beep horn + GPS navigation. Both IDs must be unique.
            </p>
          </div>
          <div className="full">
            <button className="btn primary" disabled={busy}>
              {busy ? "Registering…" : "Register Car"}
            </button>
          </div>
        </form>
      )}

      {tab === "track" && (
        <div className="grid-2">
          <div className="card">
            <h2>My Cars ({vehicles.length})</h2>
            {vehicles.length === 0 && <p className="hint">No cars registered yet.</p>}
            <div className="list">
              {vehicles.map((v) => (
                <div key={v._id} className={selected?._id === v._id ? "list-item active" : "list-item"} onClick={() => openVehicle(v)}>
                  <div>
                    <b>{v.registrationNo}</b>{" "}
                    <span className={v.status === "emergency" ? "badge danger" : v.status === "idle" ? "badge ok" : "badge"}>
                      {v.status}
                    </span>
                    <div className="muted small">
                      {v.ownerName}
                      {v.vehicleModel ? ` · ${v.vehicleModel}` : ""}
                      {v.color ? ` · ${v.color}` : ""}
                    </div>
                  </div>
                  <button
                    className="btn ghost small-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeVehicle(v._id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            {!selected ? (
              <p className="hint">Select a car to view details &amp; devices.</p>
            ) : (
              <>
                <h2>
                  {selected.registrationNo}{" "}
                  <span className={selected.status === "emergency" ? "badge danger" : "badge ok"}>{selected.status}</span>
                </h2>
                <table className="kv">
                  <tbody>
                    <tr>
                      <td>Owner</td>
                      <td>{selected.ownerName}</td>
                    </tr>
                    <tr>
                      <td>Model / Color</td>
                      <td>
                        {selected.vehicleModel || "—"} {selected.color ? `· ${selected.color}` : ""}
                      </td>
                    </tr>
                    <tr>
                      <td>Device 1</td>
                      <td>
                        {selected.devices?.[0]?.deviceId}{" "}
                        <span className={selected.devices?.[0]?.active ? "badge danger" : "badge ok"}>
                          {selected.devices?.[0]?.active ? "ACTIVE" : "idle"}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Device 2</td>
                      <td>
                        {selected.devices?.[1]?.deviceId}{" "}
                        <span className={selected.devices?.[1]?.active ? "badge danger" : "badge ok"}>
                          {selected.devices?.[1]?.active ? "ACTIVE" : "idle"}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Last location</td>
                      <td>
                        {selected.lastLocation?.lat != null ? (
                          <>
                            {selected.lastLocation.lat.toFixed(5)}, {selected.lastLocation.lng.toFixed(5)}{" "}
                            <small className="muted">({new Date(selected.lastLocation.updatedAt).toLocaleString()})</small>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <h3 className="sub">Assign patient to this car</h3>
                <select
                  value={selected.assignedPatientId || ""}
                  onChange={(e) => assignPatient(e.target.value)}
                >
                  <option value="">— None —</option>
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.relation})
                    </option>
                  ))}
                </select>
                {selected.assignedPatientId && (
                  <p className="hint">
                    Assigned: {patients.find((p) => p._id === selected.assignedPatientId)?.name || "patient"}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
