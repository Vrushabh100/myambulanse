import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setSession, saveMobile, getSavedMobile } from "../api.js";

const MOBILE_RE = /^[6-9]\d{9}$/;

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("register");
  const [role, setRole] = useState("patient");
  const [form, setForm] = useState({
    mobile: getSavedMobile(),
    name: "",
    address: "",
    degree: "",
    specialization: ""
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

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

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="auth-logo">🚑</div>
        <div className="auth-badge">
          <span className="badge ink">
            <span className="star">★</span> One-time registration · No OTP
          </span>
        </div>
        <h1>MyAmbulance</h1>
        <p>
          Your private car becomes an emergency ambulance in one press. Register once — on your
          usual network you're logged in automatically. No OTP. No password.
        </p>
        <div className="feat-row">
          <span className="key-chip"><span className="key-cap">SOS</span> Siren</span>
          <span className="key-chip"><span className="key-cap">LED</span> Red &amp; blue lights</span>
          <span className="key-chip"><span className="key-cap">BEEP</span> Horn</span>
          <span className="key-chip"><span className="key-cap">GPS</span> Navigation</span>
          <span className="key-chip"><span className="key-cap">MD</span> Doctor alert</span>
        </div>
      </div>

      <div className="card auth-card">
        <div className="seg">
          <button
            type="button"
            className={mode === "register" ? "seg-btn active" : "seg-btn"}
            onClick={() => setMode("register")}
          >
            Register
          </button>
          <button
            type="button"
            className={mode === "login" ? "seg-btn active" : "seg-btn"}
            onClick={() => setMode("login")}
          >
            Login
          </button>
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

          {error && <div className="error">{error}</div>}

          <button className="btn primary wide" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
