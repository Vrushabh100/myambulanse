import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setSession, saveMobile, saveDeviceToken, setRecovery } from "../../api.js";
import MpinInput from "../../components/MpinInput.jsx";
import { SECURITY_QUESTIONS } from "../../constants/securityQuestions.js";
import { MOBILE_RE, WEAK_MPIN_MESSAGE, weakMpin } from "../../mpinRules.js";

export default function RegisterForm({ onLogin, onSwitch }) {
  const [role, setRole] = useState("patient");
  const [form, setForm] = useState({ mobile: "", name: "", address: "", degree: "", specialization: "", clinicAddress: "", clinicLat: "", clinicLng: "" });
  const [contacts, setContacts] = useState([{ name: "", relation: "", mobile: "" }]);
  const [mpin, setMpin] = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");
  const [questions, setQuestions] = useState(SECURITY_QUESTIONS);
  const [question, setQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { api("/auth/mpin/questions").then((d) => { if (d && Array.isArray(d.questions) && d.questions.length) { setQuestions(d.questions); setQuestion(d.questions[0]); } }).catch(() => {}); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const updateContact = (i, k, v) => setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!MOBILE_RE.test(form.mobile)) { setError("Enter a valid 10-digit mobile number."); return; }
    if (!form.name.trim()) { setError("Please enter your full name."); return; }
    if (!/^\d{6}$/.test(mpin)) { setError("MPIN must be exactly 6 digits."); return; }
    if (weakMpin(mpin)) { setError(WEAK_MPIN_MESSAGE); return; }
    if (mpin !== confirmMpin) { setError("MPIN and confirm MPIN do not match."); return; }
    if (!question) { setError("Choose a security question."); return; }
    if (answer.trim().length < 2) { setError("Please enter your security answer."); return; }
    if (role !== "doctor") {
      const rows = contacts.map((c) => ({ name: c.name.trim(), relation: c.relation.trim(), mobile: c.mobile.trim() }));
      if (!rows[0].name || !MOBILE_RE.test(rows[0].mobile)) { setError("Add at least one emergency contact (name + 10-digit mobile)."); return; }
      for (let i = 1; i < rows.length; i += 1) { if ((rows[i].name || rows[i].mobile) && (!rows[i].name || !MOBILE_RE.test(rows[i].mobile))) { setError(`Emergency contact #${i + 1} needs a name and 10-digit mobile.`); return; } }
    }
    setBusy(true);
    try {
      const body = { mobile: form.mobile, name: form.name.trim(), role, address: form.address, mpin, securityQuestion: question, answer };
      if (role === "doctor") body.doctorProfile = { degree: form.degree, specialization: form.specialization, clinicAddress: form.clinicAddress, clinicLat: form.clinicLat, clinicLng: form.clinicLng };
      else body.emergencyContacts = contacts.map((c) => ({ name: c.name.trim(), relation: c.relation.trim(), mobile: c.mobile.trim() })).filter((c) => c.name || c.mobile);
      const data = await api("/auth/register", { method: "POST", body });
      if (data.pending === true || data.approvalStatus === "pending") {
        navigate("/auth/register/approval", { replace: true });
        return;
      }
      setSession(data.token, data.user);
      saveMobile(form.mobile);
      if (data.deviceToken) saveDeviceToken(data.deviceToken);
      setRecovery(false);
      onLogin(data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <div className="seg">
        <button type="button" className={role === "patient" ? "seg-btn active" : "seg-btn"} onClick={() => setRole("patient")}>Patient / Family</button>
        <button type="button" className={role === "doctor" ? "seg-btn active" : "seg-btn"} onClick={() => setRole("doctor")}>Doctor</button>
      </div>
      <label>Full name</label>
      <input required value={form.name} onChange={set("name")} placeholder="e.g. Rahul Sharma" />
      {role === "patient" ? (
        <><label>Address</label><input value={form.address} onChange={set("address")} placeholder="Home address" /></>
      ) : (
        <>
          <label>Degree</label>
          <input value={form.degree} onChange={set("degree")} placeholder="e.g. MBBS, MD" />
          <label>Specialization</label>
          <input value={form.specialization} onChange={set("specialization")} placeholder="e.g. Cardiology" />
          <label>Clinic / Hospital address</label>
          <input value={form.clinicAddress} onChange={set("clinicAddress")} placeholder="Clinic / Hospital address" />
          <label>Clinic latitude</label>
          <input inputMode="decimal" value={form.clinicLat} onChange={set("clinicLat")} placeholder="e.g. 21.1458" />
          <label>Clinic longitude</label>
          <input inputMode="decimal" value={form.clinicLng} onChange={set("clinicLng")} placeholder="e.g. 79.0882" />
          <p className="hint">Optional but recommended — enter your clinic's exact coordinates so patients get the accurate Google Maps location.</p>
        </>
      )}
      <label>Mobile number</label>
      <input required inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))} placeholder="10-digit mobile" />
      <label>MPIN (6 digits)</label>
      <MpinInput value={mpin} onChange={setMpin} disabled={busy} />
      <label>Confirm MPIN</label>
      <MpinInput value={confirmMpin} onChange={setConfirmMpin} disabled={busy} placeholder="Re-enter MPIN" />
      <label>Security question (for MPIN recovery)</label>
      <select value={question} onChange={(e) => setQuestion(e.target.value)}>
        {questions.map((q, i) => <option key={i} value={q}>{q}</option>)}
      </select>
      <label>Answer</label>
      <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" />
      <p className="hint">Capital letters, spaces and punctuation in your answer don't matter — "Ujwal", "UJWAL", "u jwal", "ujw al" all match.</p>
      {role !== "doctor" && (
        <div className="contact-section">
          <label>Emergency contact — one of your closest ones / a family member</label>
          <p className="hint">Called instantly when you press SOS. Up to 4.</p>
          {contacts.map((c, i) => (
            <div className="contact-row" key={i}>
              <input value={c.name} onChange={(e) => updateContact(i, "name", e.target.value)} placeholder="Name" />
              <input value={c.relation} onChange={(e) => updateContact(i, "relation", e.target.value)} placeholder="Wife / Son / Father" />
              <input inputMode="numeric" maxLength={10} value={c.mobile} onChange={(e) => updateContact(i, "mobile", e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile" />
              {contacts.length > 1 && (<button type="button" className="contact-remove" onClick={() => setContacts((cs) => cs.filter((_, idx) => idx !== i))} aria-label="Remove contact">×</button>)}
            </div>
          ))}
          {contacts.length < 4 && (<button type="button" className="contact-add" onClick={() => setContacts((cs) => [...cs, { name: "", relation: "", mobile: "" }])}>+ Add another contact</button>)}
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <button className="btn primary wide" disabled={busy}>{busy ? "Please wait..." : "Create account"}</button>
      <button type="button" className="auth-switch" onClick={() => { if (onSwitch) onSwitch(); else navigate("/auth/login"); }}>Already have an account — Login</button>
    </form>
  );
}