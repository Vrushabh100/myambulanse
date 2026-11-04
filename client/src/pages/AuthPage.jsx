import React, { useEffect, useState } from "react";
import AmbulanceLoader from "../components/AmbulanceLoader.jsx";
import LoginForm from "./auth/LoginForm.jsx";
import RegisterForm from "./auth/RegisterForm.jsx";

export default function AuthPage({ mode: modeProp = "register", onLogin }) {
  const [mode, setMode] = useState(modeProp);

  useEffect(() => { setMode(modeProp); }, [modeProp]);
  useEffect(() => { try { localStorage.setItem("ma_visited", "1"); } catch {} }, []);

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="auth-logo"><AmbulanceLoader mini /></div>
        <div className="auth-badge">
          <span className="badge ink"><span className="star">★</span> Convert your car into ambulance Instantly.</span>
        </div>
        <h1>MyAmbulance</h1>
        <p>Your private car becomes an emergency ambulance in one press. Register once — then log in with your 6-digit MPIN.</p>
      </div>
      <div className="card auth-card">
        <div className="seg wide-seg auth-seg">
          <button type="button" className={mode === "login" ? "seg-btn active" : "seg-btn"} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={mode === "register" ? "seg-btn active" : "seg-btn"} onClick={() => setMode("register")}>Register</button>
        </div>
        {mode === "login" ? <LoginForm onLogin={onLogin} onSwitch={() => setMode("register")} /> : <RegisterForm onLogin={onLogin} onSwitch={() => setMode("login")} />}
      </div>
    </div>
  );
}