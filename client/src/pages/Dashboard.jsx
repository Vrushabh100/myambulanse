import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { doctorLabel } from "../format.js";
import {
  IconUsers,
  IconCar,
  IconStethoscope,
  IconPhone,
  IconAmbulance,
  IconSiren,
  IconWhatsApp
} from "../components/Icon.jsx";
import AmbulanceLoader from "../components/AmbulanceLoader.jsx";

const EMERGENCIES = [
  "Heart attack / Chest pain",
  "Breathing difficulty",
  "Stroke symptoms",
  "Severe bleeding / Accident",
  "Snake bite / Poisoning",
  "Fracture / Serious injury",
  "Pregnancy complication",
  "High fever + unconscious",
  "General emergency"
];

const RING = [
  { icon: IconUsers, label: "Patients", to: "/patients" },
  { icon: IconCar, label: "Vehicles", to: "/vehicles", badge: "vehicles" },
  { icon: IconStethoscope, label: "Doctor", to: "/doctor" },
  { icon: IconAmbulance, label: "108", href: "tel:108" },
  { icon: IconSiren, label: "112", href: "tel:112" },
  { icon: IconWhatsApp, label: "WhatsApp", wa: true }
];

function DevicePanel({ state }) {
  if (!state) return null;
  return (
    <div className="device-panel">
      <h3>🚗 Car Device Kit — Simulated</h3>
      <div className="device-grid">
        <div className={state.siren ? "device on" : "device"}>
          <div className="device-icon">🚨</div>
          <b>Siren</b>
          <span>{state.siren ? "ON" : "OFF"}</span>
        </div>
        <div className={state.beep ? "device on beep" : "device"}>
          <div className="device-icon">🔊</div>
          <b>Beep</b>
          <span>{state.beep ? "ON" : "OFF"}</span>
        </div>
        <div className={state.redLight ? "device on red" : "device"}>
          <div className="device-icon">🔴</div>
          <b>Red Light</b>
          <span>{state.redLight ? "FLASHING" : "OFF"}</span>
        </div>
        <div className={state.blueLight ? "device on blue" : "device"}>
          <div className="device-icon">🔵</div>
          <b>Blue Light</b>
          <span>{state.blueLight ? "FLASHING" : "OFF"}</span>
        </div>
        <div className={state.navigation ? "device on nav" : "device"}>
          <div className="device-icon">🧭</div>
          <b>Navigation</b>
          <span>{state.navigation ? "ROUTING" : "OFF"}</span>
        </div>
      </div>
    </div>
  );
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function playSosSiren() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.06;
    const t = ctx.currentTime;
    for (let i = 0; i < 10; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? 600 : 1000, t + i * 0.5);
    }
    osc.start();
    osc.stop(t + 5);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 5300);
  } catch {}
}

const WA_BASE = "EMERGENCY from MyAmbulance — My family may need help";

function waShareUrl(coords) {
  let text = WA_BASE;
  if (coords && coords.lat != null && coords.lng != null) {
    text += `. Location: https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export default function Dashboard({ user }) {
  const [patients, setPatients] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [emergencyType, setEmergencyType] = useState("General emergency");
  const [active, setActive] = useState(null);
  const [panelHidden, setPanelHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emergencies, setEmergencies] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [lastLoc, setLastLoc] = useState(null);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [docList, setDocList] = useState(null);
  const [docBusy, setDocBusy] = useState(false);
  const [docErr, setDocErr] = useState("");

  const docQuery = docSearch.trim().toLowerCase();
  const docFiltered = (docList || []).filter((d) => {
    if (!docQuery) return true;
    return [d.name, d.specialization, d.mobile]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(docQuery));
  });

  function toggleDocPicker() {
    const next = !docPickerOpen;
    setDocPickerOpen(next);
    setDocErr("");
    if (next && docList === null) {
      api("/doctors")
        .then((list) => setDocList(Array.isArray(list) ? list : []))
        .catch(() => {
          setDocList([]);
          setDocErr("Could not load doctors. Check your connection and try again.");
        });
    }
  }

  async function selectDoctor(doc) {
    if (docBusy) return;
    setDocErr("");
    if (!patientId) {
      setDocErr("Family doctor is saved per family member — pick a person in “Who” first, or add a member in My Patients.");
      return;
    }
    setDocBusy(true);
    try {
      const personalDoctor = doc
        ? { name: doc.name, degree: doc.degree || "", specialization: doc.specialization || "", mobile: doc.mobile || "", doctorId: doc.id }
        : { name: "", degree: "", specialization: "", mobile: "", doctorId: null };
      const updated = await api(`/patients/${patientId}`, { method: "PUT", body: { personalDoctor } });
      setPatients((list) => list.map((p) => (p._id === updated._id ? updated : p)));
      setDocPickerOpen(false);
      setDocSearch("");
    } catch (e) {
      setDocErr(e.message);
    } finally {
      setDocBusy(false);
    }
  }

  const navigate = useNavigate();

  useEffect(() => {
    api("/patients").then(setPatients).catch(() => {});
    api("/vehicles").then(setVehicles).catch(() => {});
    api("/emergencies/active").then((list) => setActive(list[0] || null)).catch(() => {});
    loadHistory();
  }, []);

  function loadHistory() {
    api("/emergencies").then(setEmergencies).catch(() => {});
    api("/emergencies/stats").then(setStats).catch(() => {});
  }

  function pickPatient(id) {
    setPatientId(id);
    if (id) {
      const p = patients.find((x) => x._id === id);
      if (p && p.defaultEmergency) setEmergencyType(p.defaultEmergency);
    }
  }

  async function triggerSos() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      navigator.vibrate?.([150, 80, 150]);
    } catch {}
    const location = await getLocation();
    try {
      const emergency = await api("/emergencies/sos", {
        method: "POST",
        body: { patientId: patientId || null, vehicleId: vehicleId || null, emergencyType, location }
      });
      setActive(emergency);
      setPanelHidden(false);
      playSosSiren();
      loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelSos() {
    if (!active) return;
    try {
      await api(`/emergencies/${active._id}/cancel`, { method: "POST" });
      setActive(null);
      setPanelHidden(false);
      loadHistory();
    } catch (err) {
      setError(err.message);
    }
  }

  function shareWhatsapp(e) {
    e.preventDefault();
    const coords = active?.location?.lat != null ? active.location : lastLoc;
    if (coords) {
      window.open(waShareUrl(coords), "_blank");
      return;
    }
    if (!navigator.geolocation) {
      window.open(waShareUrl(null), "_blank");
      return;
    }
    const w = window.open("about:blank", "_blank");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLastLoc(c);
        const u = waShareUrl(c);
        if (w) w.location = u;
        else window.open(u, "_blank");
      },
      () => {
        const u = waShareUrl(null);
        if (w) w.location = u;
        else window.open(u, "_blank");
      },
      { enableHighAccuracy: true, timeout: 4000 }
    );
  }

  const activeName = active?.patientSnapshot?.name || user.name;
  const activeMobile = active?.patientSnapshot?.mobile || user.mobile;
  const hasLocation = active?.location?.lat != null;
  const mapsUrl = hasLocation
    ? `https://www.google.com/maps?q=${active.location.lat},${active.location.lng}`
    : null;

  const overlayOpen = !!active && !panelHidden;
  const selectedPatient = patients.find((p) => p._id === patientId);
  const familyDoc = selectedPatient?.personalDoctor;

  function historyBadge(status) {
    if (status === "active") return "badge danger";
    if (status === "acknowledged" || status === "referred") return "badge warn";
    if (status === "resolved") return "badge ok";
    return "badge";
  }

  const activeId = active?._id || null;
  const activeStatus = active?.status || null;
  const emgDoctorName = doctorLabel(active?.patientSnapshot?.personalDoctor?.name, { withDot: true });
  const emgDoctorMobile = (active?.patientSnapshot?.personalDoctor?.mobile || "").trim();
  const emgFamilyContact = active?.patientSnapshot?.emergencyContacts?.[0] || null;
  const emgLoaderTitle = emgDoctorName ? `Calling ${emgDoctorName}` : "Connecting to doctor";

  const activeRef = useRef(null);
  activeRef.current = active;
  const [emgStage, setEmgStage] = useState("loader");
  const emgStageRef = useRef("loader");
  const emgTimerRef = useRef(null);
  const emgTimerOnRef = useRef(false);
  const emgSeenIdRef = useRef(null);

  function applyEmgStage(next) {
    emgStageRef.current = next;
    setEmgStage(next);
  }

  function clearEmgPhaseTimer() {
    if (emgTimerRef.current) clearTimeout(emgTimerRef.current);
    emgTimerRef.current = null;
    emgTimerOnRef.current = false;
  }

  // Reset the phase machine whenever the overlay closes or unmounts.
  useEffect(() => {
    return () => {
      clearEmgPhaseTimer();
      emgSeenIdRef.current = null;
      applyEmgStage("loader");
    };
  }, [overlayOpen]);

  // Phase machine:
  //   status "active"                       -> "Calling <doctor>" animation, DevicePanel hidden
  //   status "acknowledged" | "referred"    -> same animation titled "Getting car device ready",
  //                                            then EXACTLY 5s later swap to <DevicePanel/>
  //   opens already acknowledged/referred   -> DevicePanel immediately (5s skipped)
  //   back to "active"                      -> phase 1 again
  useEffect(() => {
    if (!overlayOpen || !active) return;
    const id = String(active._id);
    const ready = active.status === "acknowledged" || active.status === "referred";
    if (emgSeenIdRef.current !== id) {
      clearEmgPhaseTimer();
      emgSeenIdRef.current = id;
      applyEmgStage(ready ? "device" : "loader");
      return;
    }
    if (!ready) {
      clearEmgPhaseTimer();
      applyEmgStage("loader");
      return;
    }
    if (emgStageRef.current === "loader" && !emgTimerOnRef.current) {
      emgTimerOnRef.current = true;
      emgTimerRef.current = setTimeout(() => {
        emgTimerRef.current = null;
        emgTimerOnRef.current = false;
        applyEmgStage("device");
      }, 5000);
    }
  }, [overlayOpen, activeId, activeStatus]);

  // Live SOS state: poll GET /emergencies/active every 4s while ANY SOS view is on
  useEffect(() => {
    // Watch even while the panel is hidden (sticky banner must auto-close too).
    if (!activeId) return undefined;
    let stopped = false;
    const tick = async () => {
      let list;
      try {
        list = await api("/emergencies/active");
      } catch {
        return;
      }
      if (stopped) return;
      const cur = activeRef.current;
      if (!cur || String(cur._id) !== String(activeId)) return;
      const found = Array.isArray(list) ? list.find((e) => e._id === activeId) : null;
      if (!found || found.status === "resolved" || found.status === "cancelled") {
        setActive(null);
        loadHistory();
        return;
      }
      if (
        found.status !== cur.status ||
        JSON.stringify(found.deviceState) !== JSON.stringify(cur.deviceState)
      ) {
        setActive(found);
      }
    };
    const timer = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [overlayOpen, activeId]);

  return (
    <div>
      {active && panelHidden && (
        <div
          className="incoming-banner"
          style={{ position: "sticky", top: 70, zIndex: 60, cursor: "pointer", marginBottom: 18 }}
          onClick={() => setPanelHidden(false)}
        >
          <div className="ringing-icon">🆘</div>
          <b style={{ flex: 1 }}>SOS ACTIVE — tap to reopen</b>
          <button
            className="btn ghost small-btn"
            onClick={(e) => {
              e.stopPropagation();
              cancelSos();
            }}
          >
            Cancel SOS
          </button>
        </div>
      )}

      <div className="card hub-card">
        {!overlayOpen && (
          <div className="hub-sos-area">
            <div className="sos-ring">
              {RING.map((b, i) => {
                const showBadge = b.badge === "vehicles" && vehicles.length === 0;
                const IconComp = b.icon;
                const inner = (
                  <>
                    <span className="ha-icon">
                      <IconComp size={20} />
                    </span>
                    <span className="ha-label">{b.label}</span>
                    {showBadge && <span className="dot" />}
                  </>
                );
                if (b.to) {
                  return (
                    <a
                      key={b.label}
                      className="ring-btn"
                      style={{ "--i": i }}
                      href={b.to}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(b.to);
                      }}
                    >
                      {inner}
                    </a>
                  );
                }
                if (b.href) {
                  return (
                    <a key={b.label} className="ring-btn" style={{ "--i": i }} href={b.href}>
                      {inner}
                    </a>
                  );
                }
                return (
                  <a
                    key={b.label}
                    className="ring-btn"
                    style={{ "--i": i }}
                    href={waShareUrl(active?.location?.lat != null ? active.location : lastLoc)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={shareWhatsapp}
                  >
                    {inner}
                  </a>
                );
              })}
              <button
                className={busy ? "sos-btn pressing" : "sos-btn"}
                onClick={triggerSos}
                disabled={busy}
              >
                <span className="sos-label">SOS</span>
                <span className="sos-sub-label">{busy ? "Sending..." : "Press for help"}</span>
              </button>
            </div>
            <div className="sos-sub">
              {busy
                ? "Sending SOS — getting location..."
                : "One press → siren, lights & your doctor are alerted."}
            </div>
          </div>
        )}

        <div className="hub-head">
          <div className="eyebrow">Emergency Hub</div>
          <h1 className="hero-title">
            One press.
            <br />
            Help is on the way.
          </h1>
          <p className="lead hub-lead">
            Siren, lights, calls and your doctor — triggered from a single button.
          </p>
        </div>

        <div className="hub-context">
          <div className="hub-ctx-row">
            <span className="hub-ctx-label">Who</span>
            <div className="chip-row">
              <button
                type="button"
                className={patientId === "" ? "chip active" : "chip"}
                onClick={() => pickPatient("")}
              >
                Me ({user.name})
              </button>
              {patients.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  className={patientId === p._id ? "chip active" : "chip"}
                  onClick={() => pickPatient(p._id)}
                >
                  {p.name} ({p.relation})
                </button>
              ))}
            </div>
          </div>

          <div className="hub-ctx-row">
            <span className="hub-ctx-label">Car</span>
            {vehicles.length > 0 ? (
              <div className="chip-row">
                <button
                  type="button"
                  className={vehicleId === "" ? "chip active" : "chip"}
                  onClick={() => setVehicleId("")}
                >
                  No vehicle
                </button>
                {vehicles.map((v) => (
                  <button
                    key={v._id}
                    type="button"
                    className={vehicleId === v._id ? "chip active" : "chip"}
                    onClick={() => setVehicleId(v._id)}
                  >
                    {v.registrationNo}
                  </button>
                ))}
              </div>
            ) : (
              <span className="hint" style={{ margin: 0 }}>
                No car registered yet. <Link to="/vehicles">Register a car →</Link>
              </span>
            )}
          </div>

          <div className="hub-ctx-row">
            <span className="hub-ctx-label">Doctor</span>
            {familyDoc && familyDoc.name ? (
              <div className="chip-row">
                <span className="chip doc-chip">
                  {doctorLabel(familyDoc.name)}
                  {familyDoc.specialization ? " · " + familyDoc.specialization : ""}
                </span>
                {familyDoc.mobile ? (
                  <a className="chip call-chip" href={"tel:" + familyDoc.mobile}>
                    <IconPhone size={14} />
                    Call
                  </a>
                ) : null}
                <button type="button" className="btn ghost small-btn" onClick={toggleDocPicker}>
                  Change
                </button>
              </div>
            ) : (
              <span className="hint" style={{ margin: 0 }}>
                No family doctor set{" — "}
                <button type="button" className="btn ghost small-btn" onClick={toggleDocPicker}>
                  Add Doctor
                </button>
                .
              </span>
            )}
            {docPickerOpen && (
              <div className="doc-picker">
                <input
                  type="text"
                  placeholder="Search doctor by name / specialization"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  autoFocus
                />
                {docList === null ? (
                  <p className="muted small" style={{ margin: "8px 0 0" }}>
                    Loading doctors...
                  </p>
                ) : (
                  <div className="doc-list">
                    {docFiltered.length === 0 ? (
                      <p className="muted small" style={{ margin: "8px 0" }}>
                        No doctors match your search.
                      </p>
                    ) : (
                      docFiltered.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="doc-row"
                          disabled={docBusy}
                          onClick={() => selectDoctor(d)}
                        >
                          <span>{doctorLabel(d.name)}{d.specialization ? " · " + d.specialization : ""}</span>
                          <span className="muted small">{d.mobile}</span>
                        </button>
                      ))
                    )}
                    {patientId && familyDoc && familyDoc.name ? (
                      <button
                        type="button"
                        className="doc-row doc-row-clear"
                        disabled={docBusy}
                        onClick={() => selectDoctor(null)}
                      >
                        {"— None / clear —"}
                      </button>
                    ) : null}
                  </div>
                )}
                {docErr && (
                  <div className="error" style={{ marginTop: 8 }}>
                    {docErr}
                  </div>
                )}
                <div className="row-actions" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn ghost small-btn"
                    onClick={() => {
                      setDocPickerOpen(false);
                      setDocErr("");
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hub-ctx-row">
            <span className="hub-ctx-label">Type</span>
            <select value={emergencyType} onChange={(e) => setEmergencyType(e.target.value)}>
              {!EMERGENCIES.includes(emergencyType) && <option key={emergencyType}>{emergencyType}</option>}
              {EMERGENCIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="stat-strip">
          <div className="display-stat">
            <b>{stats.total}</b>
            <span>Total SOS</span>
          </div>
          <div className="display-stat">
            <b>{stats.active}</b>
            <span>Active</span>
          </div>
          <div className="display-stat">
            <b>{stats.resolved}</b>
            <span>Resolved</span>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
      </div>

      <div className="card">
        <h3>SOS history</h3>
        {emergencies.length === 50 && (
          <p className="muted small">Showing latest 50 — see Total for all-time count.</p>
        )}
        {emergencies.length === 0 && <p className="hint">No SOS raised yet.</p>}
        <div className="list">
          {emergencies.map((e) => (
            <div
              key={e._id}
              className={active && active._id === e._id ? "list-item active" : "list-item"}
              onClick={() => {
                if (e.status === "active" || e.status === "acknowledged" || e.status === "referred") {
                  setActive(e);
                  setPanelHidden(false);
                }
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className={historyBadge(e.status)}>{e.status}</span>
                <b>{e.emergencyType}</b>
                <span className="muted small">{e.patientSnapshot?.name}</span>
                {e.status === "referred" && e.referral?.toDoctorName && (
                  <span className="muted small">→ Dr {e.referral.toDoctorName}</span>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="muted small">{new Date(e.createdAt).toLocaleString()}</div>
                {e.status === "resolved" && e.doctorNote && (
                  <div className="small muted">📝 {e.doctorNote}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {active && !panelHidden && (
        <div className="emg-overlay">
          <div className="emg-sheet">
            <h2 className="emg-title">🆘 SOS ACTIVE</h2>
            <p style={{ color: "var(--red)", fontWeight: 800, margin: "0 0 8px" }}>
              {activeName} — {active.emergencyType}
            </p>
            <p className="hint">
              {hasLocation ? (
                <>
                  📍 {active.location.lat.toFixed(5)}, {active.location.lng.toFixed(5)}{" "}
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                </>
              ) : (
                "Location unavailable (GPS off)"
              )}
            </p>

            <div className="emg-actions">
              {emgDoctorName && emgDoctorMobile ? (
                <a className="call-btn" href={`tel:${emgDoctorMobile}`}>
                  📞 Call {emgDoctorName} ({emgDoctorMobile})
                </a>
              ) : (
                <a className="call-btn" href={`tel:${activeMobile}`}>
                  📞 Call {activeName} ({activeMobile})
                </a>
              )}
              {emgFamilyContact && (
                <a className="call-btn ghost compact" href={`tel:${emgFamilyContact.mobile}`}>
                  📞 Call {emgFamilyContact.name}{emgFamilyContact.relation ? ` (${emgFamilyContact.relation})` : ""}
                </a>
              )}
            </div>

            {emgStage === "loader" ? (
              <div className="emg-loader-wrap">
                <AmbulanceLoader
                  title={activeStatus === "active" ? emgLoaderTitle : "Getting car device ready"}
                />
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <DevicePanel state={active.deviceState} />
              </div>
            )}

            <div className="row-actions" style={{ justifyContent: "center" }}>
              <button className="btn danger small-btn" onClick={cancelSos}>
                Cancel SOS
              </button>
              <button className="btn ghost small-btn" onClick={() => setPanelHidden(true)}>
                Close panel (SOS still active)
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
