import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

function useRingtone(active) {
  const ctxRef = useRef(null);
  const stopRef = useRef(null);

  useEffect(() => {
    if (!active) {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
      return;
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      gain.connect(ctx.destination);
      let stopped = false;
      const timers = [];
      function ring() {
        if (stopped) return;
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.connect(gain);
        const t = ctx.currentTime;
        osc.frequency.setValueAtTime(850, t);
        osc.frequency.setValueAtTime(650, t + 0.35);
        osc.frequency.setValueAtTime(850, t + 0.7);
        osc.start(t);
        osc.stop(t + 1.05);
        timers.push(setTimeout(ring, 1200));
      }
      ring();
      stopRef.current = () => {
        stopped = true;
        timers.forEach(clearTimeout);
        try {
          ctx.close();
        } catch {}
      };
    } catch {}
    return () => {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
    };
  }, [active]);
}

function shouldRing(e, myId) {
  if (e.status === "active") {
    return !e.referral || String(e.referral.toDoctorId) === String(myId);
  }
  if (e.status === "referred") {
    return String(e.referral?.toDoctorId) === String(myId);
  }
  return false;
}

function statusBadge(status) {
  if (status === "active") return "badge danger";
  if (status === "acknowledged" || status === "referred") return "badge warn";
  if (status === "resolved") return "badge ok";
  return "badge";
}

export default function DoctorPage({ user }) {
  const myId = user?.id;
  const [emergencies, setEmergencies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [dismissedRings, setDismissedRings] = useState({});
  const [flash, setFlash] = useState(null);
  const [referFor, setReferFor] = useState(null);
  const [doctors, setDoctors] = useState(null);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [referTarget, setReferTarget] = useState("");
  const [referNote, setReferNote] = useState("");
  const [referErr, setReferErr] = useState("");

  const aliveRef = useRef(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  function startAction() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  }
  function endAction() {
    busyRef.current = false;
    setBusy(false);
  }

  async function load() {
    try {
      const list = await api("/emergencies");
      if (!aliveRef.current) return;
      setEmergencies(list);
      setSelected((sel) => (sel ? list.find((e) => e._id === sel._id) || null : sel));
      setError("");
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e.message);
    }
  }

  useEffect(() => {
    aliveRef.current = true;
    load();
    const t = setInterval(load, 5000);
    return () => {
      aliveRef.current = false;
      clearInterval(t);
    };
  }, []);

  const ringing = emergencies.filter((e) => shouldRing(e, myId) && !dismissedRings[e._id]);
  useRingtone(ringing.length > 0);

  function showFlash(id, msg) {
    if (!aliveRef.current) return;
    setFlash({ id, msg });
    setTimeout(() => {
      if (!aliveRef.current) return;
      setFlash((f) => (f && f.id === id && f.msg === msg ? null : f));
    }, 4000);
  }

  async function approve(id) {
    if (!startAction()) return;
    try {
      await api(`/emergencies/${id}/approve`, { method: "POST" });
      setDismissedRings((d) => ({ ...d, [id]: true }));
      showFlash(id, "Approved");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      endAction();
    }
  }

  async function cancelEmergency(id) {
    if (!window.confirm("Cancel this emergency? The SOS will be closed and the device cleared.")) return;
    if (!startAction()) return;
    try {
      await api(`/emergencies/${id}/cancel`, { method: "POST" });
      setDismissedRings((d) => ({ ...d, [id]: true }));
      setReferFor((r) => (r === id ? null : r));
      showFlash(id, "Cancelled");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      endAction();
    }
  }

  function openRefer(id) {
    setReferFor(id);
    setReferTarget("");
    setReferNote("");
    setReferErr("");
    if (doctors) return;
    setDoctorsLoading(true);
    api("/doctors")
      .then((list) => setDoctors(Array.isArray(list) ? list : []))
      .catch((e) => setReferErr(e.message))
      .finally(() => setDoctorsLoading(false));
  }

  async function sendReferral(id) {
    if (!referTarget) {
      setReferErr("Pick a doctor to refer to.");
      return;
    }
    setReferErr("");
    if (!startAction()) return;
    try {
      const target = (doctors || []).find((d) => String(d.id) === String(referTarget));
      await api(`/emergencies/${id}/refer`, {
        method: "POST",
        body: { toDoctorId: referTarget, note: referNote.trim() }
      });
      setReferFor(null);
      setReferTarget("");
      setReferNote("");
      showFlash(id, target ? `Referred to Dr ${target.name}` : "Referred");
      load();
    } catch (e) {
      setReferErr(e.message);
    } finally {
      endAction();
    }
  }

  async function resolve(id) {
    if (!startAction()) return;
    try {
      await api(`/emergencies/${id}/resolve`, { method: "POST", body: { doctorNote: note } });
      setDismissedRings((d) => ({ ...d, [id]: true }));
      setNote("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      endAction();
    }
  }

  const sel = selected;
  const selOpen = sel && !["resolved", "cancelled"].includes(sel.status);
  const selReferable = sel && ["active", "acknowledged", "referred"].includes(sel.status);
  const selToMe = sel?.referral && String(sel.referral.toDoctorId) === String(myId);

  function otherDoctors() {
    return (doctors || []).filter((d) => String(d.id) !== String(myId));
  }

  return (
    <div>
      <div className="eyebrow">Doctor</div>
      <h2 style={{ marginTop: 0 }}>
        Emergency Console {user?.role === "doctor" ? "" : "(demo view for patients)"}
      </h2>
      {error && <div className="error">{error}</div>}

      {ringing.length > 0 && (
        <div className="incoming-banner">
          <div className="ringing-icon">📞</div>
          <div style={{ flex: 1 }}>
            <b>📞 INCOMING EMERGENCY — {ringing.length} active</b>
            <div className="small">Patient details are below. Approve, refer or cancel.</div>
            <div className="row-actions" style={{ marginTop: 8 }}>
              <button className="btn primary small-btn approve" disabled={busy} onClick={() => approve(ringing[0]._id)}>
                Approve
              </button>
              <button
                className="btn ghost small-btn"
                disabled={busy}
                onClick={() => {
                  setSelected(ringing[0]);
                  openRefer(ringing[0]._id);
                }}
              >
                Refer
              </button>
              <button className="btn danger small-btn" disabled={busy} onClick={() => cancelEmergency(ringing[0]._id)}>
                Cancel
              </button>
            </div>
          </div>
          <button
            className="btn danger"
            onClick={() =>
              setDismissedRings((d) => ({ ...d, ...Object.fromEntries(ringing.map((e) => [e._id, true])) }))
            }
          >
            Mute ring
          </button>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Emergency feed</h3>
          {emergencies.length === 0 && <p className="hint">No emergencies yet.</p>}
          <div className="list">
            {emergencies.map((e) => {
              const toMe = e.referral && String(e.referral.toDoctorId) === String(myId);
              const isRinging = shouldRing(e, myId) && !dismissedRings[e._id];
              const open = !["resolved", "cancelled"].includes(e.status);
              return (
                <div
                  key={e._id}
                  className={selected?._id === e._id ? "list-item active" : "list-item"}
                  onClick={() => setSelected(e)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <b>{e.patientSnapshot?.name || "Unknown"}</b>
                      <span className={statusBadge(e.status)}>{e.status}</span>
                      {isRinging && <span className="badge danger">ringing</span>}
                    </div>
                    <div className="muted small">
                      {e.emergencyType} · {new Date(e.createdAt).toLocaleTimeString()}
                    </div>
                    {e.status === "referred" && e.referral && (
                      toMe ? (
                        <div className="small" style={{ color: "var(--amber)", fontWeight: 800 }}>
                          → you
                        </div>
                      ) : (
                        <div className="muted small">→ Dr {e.referral.toDoctorName}</div>
                      )
                    )}
                  </div>
                  {open && (
                    <div
                      style={{ display: "flex", gap: 6, flexShrink: 0 }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {e.status === "active" && (
                        <button className="btn primary small-btn" disabled={busy} onClick={() => approve(e._id)}>
                          Approve
                        </button>
                      )}
                      <button
                        className="btn ghost small-btn"
                        disabled={busy}
                        onClick={() => {
                          setSelected(e);
                          openRefer(e._id);
                        }}
                      >
                        Refer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          {!sel ? (
            <p className="hint">
              Select an emergency to see full patient record, track history and location.
            </p>
          ) : (
            <>
              <h2>
                {sel.patientSnapshot?.name || "Unknown"}{" "}
                <span className={statusBadge(sel.status)}>{sel.status}</span>
              </h2>

              {selToMe && (sel.status === "active" || sel.status === "referred") && (
                <div className="referred-banner">
                  ⭐ REFERRED TO YOU by Dr {sel.referral.byDoctorName || "a colleague"}
                </div>
              )}

              <p className="lead">
                <b>Emergency:</b> {sel.emergencyType}
              </p>

              {sel.referral && (sel.status === "active" || sel.status === "referred") && (
                <p className="hint" style={{ margin: "0 0 6px" }}>
                  Referred to Dr {sel.referral.toDoctorName} by{" "}
                  {String(sel.referral.byDoctorId) === String(myId)
                    ? "you"
                    : `Dr ${sel.referral.byDoctorName}`}{" "}
                  at {new Date(sel.referral.at).toLocaleTimeString()}
                  {sel.referral.note ? ` — “${sel.referral.note}”` : ""}
                </p>
              )}

              <table className="kv">
                <tbody>
                  <tr>
                    <td>Patient mobile</td>
                    <td>
                      {sel.patientSnapshot?.mobile ? (
                        <a
                          href={`tel:${sel.patientSnapshot.mobile}`}
                          style={{
                            fontWeight: 800,
                            color: "var(--ink)",
                            borderBottom: "2px solid var(--yellow)",
                            textDecoration: "none"
                          }}
                        >
                          📞 {sel.patientSnapshot.mobile}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Age / Gender</td>
                    <td>
                      {sel.patientSnapshot?.age ?? "—"} / {sel.patientSnapshot?.gender || "—"}
                    </td>
                  </tr>
                  <tr>
                    <td>Blood group</td>
                    <td>{sel.patientSnapshot?.bloodGroup || "—"}</td>
                  </tr>
                  <tr>
                    <td>Diseases</td>
                    <td>{sel.patientSnapshot?.diseases?.length ? sel.patientSnapshot.diseases.join(", ") : "—"}</td>
                  </tr>
                  <tr>
                    <td>Allergies</td>
                    <td>{sel.patientSnapshot?.allergies?.length ? sel.patientSnapshot.allergies.join(", ") : "—"}</td>
                  </tr>
                  <tr>
                    <td>Emergency contacts</td>
                    <td>
                      {sel.patientSnapshot?.emergencyContacts?.length ? (
                        sel.patientSnapshot.emergencyContacts.map((c, i) => (
                          <div key={i} style={{ marginBottom: 4 }}>
                            <a
                              href={`tel:${c.mobile}`}
                              className="call-link"
                              style={{
                                fontWeight: 700,
                                color: "var(--ink)",
                                borderBottom: "2px solid var(--yellow)",
                                textDecoration: "none"
                              }}
                            >
                              📞 {c.name} ({c.relation}) — {c.mobile}
                            </a>
                          </div>
                        ))
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Personal doctor</td>
                    <td>
                      {sel.patientSnapshot?.personalDoctor?.name ? (
                        <>
                          {sel.patientSnapshot.personalDoctor.name}{" "}
                          {sel.patientSnapshot.personalDoctor.degree || ""} ·{" "}
                          {sel.patientSnapshot.personalDoctor.specialization || ""}
                          {sel.patientSnapshot.personalDoctor.mobile ? (
                            <>
                              {" · "}
                              <a
                                href={`tel:${sel.patientSnapshot.personalDoctor.mobile}`}
                                style={{
                                  fontWeight: 700,
                                  color: "var(--ink)",
                                  borderBottom: "2px solid var(--yellow)",
                                  textDecoration: "none"
                                }}
                              >
                                📞 {sel.patientSnapshot.personalDoctor.mobile}
                              </a>
                            </>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Location</td>
                    <td>
                      {sel.location?.lat != null ? (
                        <>
                          {sel.location.lat.toFixed(5)}, {sel.location.lng.toFixed(5)}{" "}
                          <a
                            href={`https://www.google.com/maps?q=${sel.location.lat},${sel.location.lng}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open map
                          </a>
                        </>
                      ) : (
                        "Location unavailable"
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Raised at</td>
                    <td>{new Date(sel.createdAt).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="sub">Patient track record (last 10)</h3>
              {sel.patientSnapshot?.healthTracker?.length ? (
                <div className="list">
                  {sel.patientSnapshot.healthTracker.map((r, i) => (
                    <div key={i} className="list-item static small">
                      <div>
                        <small className="muted">{new Date(r.date).toLocaleString()}</small>
                        <div>
                          {r.note || "—"}
                          {r.bp ? ` · BP ${r.bp}` : ""}
                          {r.sugar ? ` · Sugar ${r.sugar}` : ""}
                          {r.heartRate ? ` · HR ${r.heartRate}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hint">No prior health records.</p>
              )}

              {selOpen ? (
                <>
                  <h3 className="sub">Doctor note</h3>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Instructions / diagnosis note..."
                  />
                  <div className="row-actions">
                    {sel.status === "active" && (
                      <button className="btn primary" disabled={busy} onClick={() => approve(sel._id)}>
                        Approve
                      </button>
                    )}
                    {sel.status === "acknowledged" && (
                      <span className="badge ok">✓ Approved</span>
                    )}
                    {selReferable && (
                      <button
                        className="btn ghost"
                        disabled={busy}
                        onClick={() => (referFor === sel._id ? setReferFor(null) : openRefer(sel._id))}
                      >
                        {referFor === sel._id ? "Close refer" : "Refer"}
                      </button>
                    )}
                    <button className="btn danger" disabled={busy} onClick={() => cancelEmergency(sel._id)}>
                      Cancel
                    </button>
                    <button className="btn primary" disabled={busy} onClick={() => resolve(sel._id)}>
                      Resolve &amp; clear device
                    </button>
                    {flash?.id === sel._id && <span className="badge ok">✓ {flash.msg}</span>}
                  </div>

                  {referFor && referFor === sel._id && (
                    <div className="refer-panel">
                      <b>Refer this emergency to another doctor</b>
                      {referErr && <div className="error">{referErr}</div>}
                      {doctorsLoading && <p className="hint">Loading doctors…</p>}
                      {!doctorsLoading && doctors && otherDoctors().length === 0 && (
                        <p className="hint">No other doctors registered yet.</p>
                      )}
                      {!doctorsLoading &&
                        doctors &&
                        otherDoctors().map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className={
                              String(referTarget) === String(d.id)
                                ? "refer-doc-row selected"
                                : "refer-doc-row"
                            }
                            onClick={() => setReferTarget(String(d.id))}
                          >
                            <span>
                              <span className="rd-name">Dr {d.name}</span>
                              <span className="rd-sub">
                                {d.specialization || "General"} · 📞 {d.mobile || "—"}
                              </span>
                            </span>
                            <span className="rd-cta">
                              {String(referTarget) === String(d.id) ? "Selected ✓" : "Refer →"}
                            </span>
                          </button>
                        ))}
                      <label>Note (optional)</label>
                      <textarea
                        rows={2}
                        value={referNote}
                        onChange={(e) => setReferNote(e.target.value)}
                        placeholder="Why are you referring? e.g. needs a cardiologist"
                      />
                      <div className="row-actions">
                        <button
                          className="btn primary small-btn"
                          disabled={busy || !referTarget}
                          onClick={() => sendReferral(sel._id)}
                        >
                          Send referral
                        </button>
                        <button
                          className="btn ghost small-btn"
                          onClick={() => {
                            setReferFor(null);
                            setReferErr("");
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {flash?.id === sel._id && (
                    <div className="row-actions">
                      <span className="badge ok">✓ {flash.msg}</span>
                    </div>
                  )}
                  {sel.doctorNote && <p className="hint">📝 Doctor note: {sel.doctorNote}</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
