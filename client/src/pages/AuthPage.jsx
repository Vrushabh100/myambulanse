import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setSession, saveMobile, getSavedMobile } from "../api.js";
import AmbulanceLoader from "../components/AmbulanceLoader.jsx";

const MOBILE_RE = /^[6-9]\d{9}$/;

export default function AuthPage({ mode: modeProp = "register", onLogin }) {
  const [mode, setMode] = useState(modeProp);
  const [role, setRole] = useState("patient");
  const [form, setForm] = useState({
    mobile: getSavedMobile(),
    name: "",
    address: "",
    degree: "",
    specialization: ""
  });
  const [contacts, setContacts] = useState([{ name: "", relation: "", mobile: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.setItem("ma_visited", "1");
    } catch {
    }
  }, []);

  useEffect(() => {
    setMode(modeProp);
    setError("");
  }, [modeProp]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const updateContact = (i, k, v) =>
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!MOBILE_RE.test(form.mobile)) {
      setError("Enter a valid 10-digit mobile number starting with 6-9.");
      return;
    }
    if (mode === "register" && !form.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (mode === "register" && role !== "doctor") {
      const rows = contacts.map((c) => ({
        name: c.name.trim(),
        relation: c.relation.trim(),
        mobile: c.mobile.trim()
      }));
      if (!rows[0].name || !MOBILE_RE.test(rows[0].mobile)) {
        setError(
          "Add at least one emergency contact (your closest family member) — name + 10-digit mobile."
        );
        return;
      }
      for (let i = 1; i < rows.length; i += 1) {
        if ((rows[i].name || rows[i].mobile) && (!rows[i].name || !MOBILE_RE.test(rows[i].mobile))) {
          setError(`Emergency contact #${i + 1}: name + 10-digit mobile required`);
          return;
        }
      }
    }
    setBusy(true);
    try {
      let data;
      if (mode === "login") {
        data = await api("/auth/login", { method: "POST", body: { mobile: form.mobile } });
      } else {
        const body = {
          mobile: form.mobile,
          name: form.name.trim(),
          role,
          address: form.address
        };
        if (role === "doctor") {
          body.doctorProfile = {
            degree: form.degree,
            specialization: form.specialization
          };
        } else {
          body.emergencyContacts = contacts
            .map((c) => ({
              name: c.name.trim(),
              relation: c.relation.trim(),
              mobile: c.mobile.trim()
            }))
            .filter((c) => c.name || c.mobile);
        }
        data = await api("/auth/register", { method: "POST", body });
      }
      setSession(data.token, data.user);
      saveMobile(form.mobile);
      onLogin(data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const switchTo = mode === "login" ? "/auth/register" : "/auth/login";

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="auth-logo"><AmbulanceLoader mini /></div>
        <div className="auth-badge">
          <span className="badge ink">
            <span className="star">★</span> Convert your car into ambulance Instantly.
          </span>
        </div>
        <h1>MyAmbulance</h1>
        <p>
          Your private car becomes an emergency ambulance in one press. Register once — on your
          usual network you're logged in automatically. No OTP. No password.
        </p>
      </div>

      <div className="card auth-card">
        <div className="auth-mode-row">
          <span className="badge ink auth-mode-pill">
            {mode === "login" ? "Login" : "Register"}
          </span>
        </div>

        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <div className="seg">
                <button
                  type="button"
                  className={role === "patient" ? "seg-btn active" : "seg-btn"}
                  onClick={() => setRole("patient")}
                >
                  Patient / Family
                </button>
                <button
                  type="button"
                  className={role === "doctor" ? "seg-btn active" : "seg-btn"}
                  onClick={() => setRole("doctor")}
                >
                  Doctor
                </button>
              </div>
              <label>Full name</label>
              <input
                required
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Rahul Sharma"
              />
              {role === "patient" && (
                <>
                  <label>Address</label>
                  <input value={form.address} onChange={set("address")} placeholder="Home address" />
                </>
              )}
              {role === "doctor" && (
                <>
                  <label>Degree</label>
                  <input value={form.degree} onChange={set("degree")} placeholder="e.g. MBBS, MD" />
                  <label>Specialization</label>
                  <input
                    value={form.specialization}
                    onChange={set("specialization")}
                    placeholder="e.g. Cardiology"
                  />
                </>
              )}
            </>
          )}

          <label>Mobile number</label>
          <input
            required
            inputMode="numeric"
            maxLength={10}
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })}
            placeholder="10-digit mobile"
          />
          <p className="hint">
            No OTP, no password — 10-digit Indian mobile starting with 6-9. On this network you'll
            be logged in automatically next time.
          </p>

          {mode === "register" && role !== "doctor" && (
            <div className="contact-section">
              <label>Emergency contact — one of your closest ones / a family member</label>
              <p className="hint">
                This person is called instantly when you press SOS. You can add up to 4.
              </p>
              {contacts.map((c, i) => (
                <div className="contact-row" key={i}>
                  <input
                    value={c.name}
                    onChange={(e) => updateContact(i, "name", e.target.value)}
                    placeholder="Name"
                  />
                  <input
                    value={c.relation}
                    onChange={(e) => updateContact(i, "relation", e.target.value)}
                    placeholder="Wife / Son / Father"
                  />
                  <input
                    inputMode="numeric"
                    maxLength={10}
                    value={c.mobile}
                    onChange={(e) => updateContact(i, "mobile", e.target.value.replace(/\D/g, ""))}
                    placeholder="10-digit mobile"
                  />
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      className="contact-remove"
                      onClick={() => setContacts((cs) => cs.filter((_, idx) => idx !== i))}
                      aria-label="Remove contact"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {contacts.length < 4 && (
                <button
                  type="button"
                  className="contact-add"
                  onClick={() => setContacts((cs) => [...cs, { name: "", relation: "", mobile: "" }])}
                >
                  + Add another contact
                </button>
              )}
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <button className="btn primary wide" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>

          <button type="button" className="auth-switch" onClick={() => navigate(switchTo)}>
            {mode === "login" ? "Don't have an account — Register" : "Already have an account — Login"}
          </button>
        </form>
      </div>
    </div>
  );
}