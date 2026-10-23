import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { doctorLabel } from "../format.js";

const EMPTY = {
  name: "",
  mobile: "",
  relation: "Self",
  age: "",
  gender: "",
  bloodGroup: "",
  diseases: "",
  allergies: "",
  defaultEmergency: "General emergency",
  docName: "",
  docDegree: "",
  docSpecialization: "",
  docMobile: ""
};

const EMPTY_CONTACT = { name: "", mobile: "", relation: "" };

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [tab, setTab] = useState("track");
  const [form, setForm] = useState(EMPTY);
  const [contacts, setContacts] = useState([{ ...EMPTY_CONTACT }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tracker, setTracker] = useState({ note: "", bp: "", sugar: "", heartRate: "", weight: "" });
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");

  async function load() {
    try {
      setPatients(await api("/patients"));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    api("/doctors").then(setDoctors).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const setContact = (i, k) => (e) =>
    setContacts(contacts.map((c, idx) => (idx === i ? { ...c, [k]: e.target.value } : c)));

  function onDoctorChange(e) {
    const id = e.target.value;
    setSelectedDoctorId(id);
    const d = doctors.find((x) => String(x.id) === String(id));
    if (!d) {
      setForm((f) => ({ ...f, docName: "", docDegree: "", docSpecialization: "", docMobile: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      docName: d.name || "",
      docDegree: d.degree || "",
      docSpecialization: d.specialization || "",
      docMobile: d.mobile || ""
    }));
  }

  const doctorQuery = doctorSearch.trim().toLowerCase();
  const filteredDoctors = doctors.filter((d) => {
    if (!doctorQuery) return true;
    return [d.name, d.specialization, d.mobile]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(doctorQuery));
  });
  const selectedDoctor = doctors.find((d) => String(d.id) === String(selectedDoctorId));
  const doctorOptions =
    selectedDoctor && !filteredDoctors.some((d) => String(d.id) === String(selectedDoctorId))
      ? [...filteredDoctors, selectedDoctor]
      : filteredDoctors;
  function addContact() {
    if (contacts.length >= 4) return;
    setContacts([...contacts, { ...EMPTY_CONTACT }]);
  }

  function removeContact(i) {
    if (contacts.length <= 1) return;
    setContacts(contacts.filter((_, idx) => idx !== i));
  }

  async function addPatient(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Patient name is required.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      setError("Enter a valid 10-digit patient mobile number (starting 6-9).");
      return;
    }
    const validContacts = contacts.filter((c) => c.name.trim() || c.mobile.trim());
    if (validContacts.length === 0) {
      setError("Add at least one emergency contact (your closest family member) — name + 10-digit mobile.");
      return;
    }
    for (let i = 0; i < validContacts.length; i++) {
      const c = validContacts[i];
      if (!c.name.trim() || !/^[6-9]\d{9}$/.test(c.mobile.trim())) {
        setError(`Emergency contact #${i + 1}: name + 10-digit mobile required`);
        return;
      }
    }

    setBusy(true);
    try {
      await api("/patients", {
        method: "POST",
        body: {
          name: form.name,
          mobile: form.mobile,
          relation: form.relation,
          age: form.age ? Number(form.age) : null,
          gender: form.gender,
          bloodGroup: form.bloodGroup,
          diseases: form.diseases,
          allergies: form.allergies,
          defaultEmergency: form.defaultEmergency,
          personalDoctor: {
            name: form.docName,
            degree: form.docDegree,
            specialization: form.docSpecialization,
            mobile: form.docMobile,
            doctorId: selectedDoctorId || null
          },
          emergencyContacts: validContacts.map((c) => ({
            name: c.name.trim(),
            mobile: c.mobile.trim(),
            relation: c.relation.trim()
          }))
        }
      });
      setForm(EMPTY);
      setContacts([{ ...EMPTY_CONTACT }]);
      setSelectedDoctorId("");
      setDoctorSearch("");
      await load();
      setTab("track");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openPatient(p) {
    try {
      const full = await api(`/patients/${p._id}`);
      setSelected(full);
    } catch {
      setSelected(p);
    }
  }

  async function addTracker(e) {
    e.preventDefault();
    try {
      const updated = await api(`/patients/${selected._id}/tracker`, { method: "POST", body: tracker });
      setSelected(updated);
      setTracker({ note: "", bp: "", sugar: "", heartRate: "", weight: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removePatient(id) {
    if (!confirm("Remove this patient?")) return;
    try {
      await api(`/patients/${id}`, { method: "DELETE" });
      if (selected?._id === id) setSelected(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="eyebrow">My Patients</div>
      <div className="seg wide-seg">
        <button className={tab === "track" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("track")}>
          Track Patient
        </button>
        <button className={tab === "new" ? "seg-btn active" : "seg-btn"} onClick={() => setTab("new")}>
          + New Patient
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      {tab === "new" && (
        <form className="card form-2col" onSubmit={addPatient}>
          <h2>Add Family Member / Patient</h2>
          <div>
            <label>Patient name *</label>
            <input required value={form.name} onChange={set("name")} placeholder="Patient full name" />
            <label>Patient mobile *</label>
            <input
              required
              inputMode="numeric"
              maxLength={10}
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })}
              placeholder="10-digit mobile"
            />
            <label>Relation</label>
            <select value={form.relation} onChange={set("relation")}>
              {["Self", "Father", "Mother", "Spouse", "Son", "Daughter", "Sibling", "Grandparent", "Other"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <label>Age</label>
            <input type="number" value={form.age} onChange={set("age")} placeholder="Age" />
            <label>Gender</label>
            <select value={form.gender} onChange={set("gender")}>
              <option value="">—</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
            <label>Blood group</label>
            <select value={form.bloodGroup} onChange={set("bloodGroup")}>
              <option value="">—</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Diseases / medical conditions (comma separated)</label>
            <input value={form.diseases} onChange={set("diseases")} placeholder="e.g. Diabetes, Hypertension" />
            <label>Allergies (comma separated)</label>
            <input value={form.allergies} onChange={set("allergies")} placeholder="e.g. Penicillin" />
            <label>Default emergency type</label>
            <input
              value={form.defaultEmergency}
              onChange={set("defaultEmergency")}
              placeholder="e.g. Heart attack / Chest pain"
            />
            <h3 className="sub">Patient's Personal Doctor</h3>
            <label>Family Doctor</label>
            <input
              type="text"
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
              placeholder="Search doctor by name / specialization"
              style={{ marginBottom: 6 }}
            />
            <select value={selectedDoctorId} onChange={onDoctorChange}>
              <option value="">— None / manual —</option>
              {doctorOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {doctorLabel(d.name)}
                  {d.specialization ? " · " + d.specialization : ""}
                </option>
              ))}
              {filteredDoctors.length === 0 && !selectedDoctor && (
                <option value="" disabled>
                  No doctor matches “{doctorSearch}”
                </option>
              )}
            </select>
            <label>Doctor name</label>
            <input value={form.docName} onChange={set("docName")} placeholder="Doctor name" />
            <label>Degree</label>
            <input value={form.docDegree} onChange={set("docDegree")} placeholder="e.g. MBBS, MD" />
            <label>Specialization</label>
            <input value={form.docSpecialization} onChange={set("docSpecialization")} placeholder="e.g. Cardiology" />
            <label>Doctor mobile</label>
            <input
              inputMode="numeric"
              maxLength={10}
              value={form.docMobile}
              onChange={set("docMobile")}
              placeholder="Doctor mobile"
            />
          </div>
          <div className="full">
            <h3 className="sub" style={{ marginTop: 0 }}>
              Emergency contact — one of your closest ones / a family member
            </h3>
            <p className="hint">
              This first contact is the “family member” button shown when an SOS is active. You can add up to 4.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: "8px", marginBottom: 6 }}>
              <span className="muted small" style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11.5 }}>
                Name
              </span>
              <span className="muted small" style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11.5 }}>
                Mobile
              </span>
              <span className="muted small" style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11.5 }}>
                Relation
              </span>
              <span />
            </div>
            {contacts.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 1fr auto",
                  gap: "8px",
                  alignItems: "center",
                  marginBottom: 8
                }}
              >
                <input
                  value={c.name}
                  onChange={setContact(i, "name")}
                  placeholder="Contact name"
                  style={{ margin: 0 }}
                />
                <input
                  value={c.mobile}
                  onChange={setContact(i, "mobile")}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  style={{ margin: 0 }}
                />
                <input
                  value={c.relation}
                  onChange={setContact(i, "relation")}
                  placeholder="e.g. Son"
                  style={{ margin: 0 }}
                />
                {contacts.length > 1 ? (
                  <button type="button" className="btn ghost small-btn" onClick={() => removeContact(i)}>
                    ✕
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            {contacts.length < 4 && (
              <button type="button" className="btn ghost small-btn" onClick={addContact}>
                + Add another contact
              </button>
            )}
            <p className="hint">These people are called instantly when this patient presses SOS. The first contact is shown as the family-member call button during an active SOS.</p>
          </div>
          <div className="full">
            <button className="btn primary" disabled={busy}>
              {busy ? "Saving..." : "Add Patient"}
            </button>
          </div>
        </form>
      )}

      {tab === "track" && (
        <div className="grid-2">
          <div className="card">
            <h2>My Patients ({patients.length})</h2>
            {patients.length === 0 && <p className="hint">No patients added yet. Use "+ New Patient".</p>}
            <div className="list">
              {patients.map((p) => (
                <div key={p._id} className={selected?._id === p._id ? "list-item active" : "list-item"} onClick={() => openPatient(p)}>
                  <div>
                    <b>{p.name}</b> <small className="muted">({p.relation})</small>
                    <div className="muted small">
                      {p.mobile}
                      {p.diseases?.length ? ` · ${p.diseases.join(", ")}` : ""}
                    </div>
                  </div>
                  <button
                    className="btn ghost small-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePatient(p._id);
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
              <p className="hint">Select a patient to view track record.</p>
            ) : (
              <>
                <h2>
                  {selected.name} <small className="muted">({selected.relation})</small>
                </h2>
                <table className="kv">
                  <tbody>
                    <tr>
                      <td>Mobile</td>
                      <td>{selected.mobile}</td>
                    </tr>
                    <tr>
                      <td>Age / Gender</td>
                      <td>
                        {selected.age ?? "—"} / {selected.gender || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td>Blood group</td>
                      <td>{selected.bloodGroup || "—"}</td>
                    </tr>
                    <tr>
                      <td>Diseases</td>
                      <td>{selected.diseases?.length ? selected.diseases.join(", ") : "—"}</td>
                    </tr>
                    <tr>
                      <td>Allergies</td>
                      <td>{selected.allergies?.length ? selected.allergies.join(", ") : "—"}</td>
                    </tr>
                    <tr>
                      <td>Emergency contacts</td>
                      <td>
                        {selected.emergencyContacts?.length ? (
                          selected.emergencyContacts.map((c, i) => (
                            <div key={i}>
                              {c.name}
                              {c.relation ? ` (${c.relation})` : ""} — {c.mobile}
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
                        {selected.personalDoctor?.name
                          ? [
                          [selected.personalDoctor.name, selected.personalDoctor.degree].filter(Boolean).join(" "),
                          selected.personalDoctor.specialization,
                          selected.personalDoctor.mobile
                        ]
                          .filter(Boolean)
                          .join(" · ")
                        : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h3 className="sub">Health tracker</h3>
                <form className="tracker-form" onSubmit={addTracker}>
                  <input placeholder="Note (e.g. took medicine, chest pain episode)" value={tracker.note} onChange={(e) => setTracker({ ...tracker, note: e.target.value })} />
                  <input placeholder="BP" value={tracker.bp} onChange={(e) => setTracker({ ...tracker, bp: e.target.value })} />
                  <input placeholder="Sugar" value={tracker.sugar} onChange={(e) => setTracker({ ...tracker, sugar: e.target.value })} />
                  <input placeholder="Heart rate" value={tracker.heartRate} onChange={(e) => setTracker({ ...tracker, heartRate: e.target.value })} />
                  <input placeholder="Weight" value={tracker.weight} onChange={(e) => setTracker({ ...tracker, weight: e.target.value })} />
                  <button className="btn primary">Add record</button>
                </form>
                <div className="list">
                  {(selected.healthTracker || []).map((r, i) => (
                    <div key={i} className="list-item static">
                      <div>
                        <small className="muted">{new Date(r.date).toLocaleString()}</small>
                        <div>
                          {r.note || "—"}
                          {r.bp ? ` · BP ${r.bp}` : ""}
                          {r.sugar ? ` · Sugar ${r.sugar}` : ""}
                          {r.heartRate ? ` · HR ${r.heartRate}` : ""}
                          {r.weight ? ` · ${r.weight}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!selected.healthTracker || selected.healthTracker.length === 0) && (
                    <p className="hint">No health records yet.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
