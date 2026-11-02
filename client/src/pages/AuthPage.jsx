import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AmbulanceLoader from "../components/AmbulanceLoader.jsx";
import LoginForm from "./auth/LoginForm.jsx";
import RegisterForm from "./auth/RegisterForm.jsx";

export default function AuthPage({ mode: modeProp = "register", onLogin }) {
  const [mode, setMode] = useState(modeProp);
  const navigate = useNavigate();

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
        <div className="auth-mode-row">
          <button
            type="button"
            className="badge ink auth-mode-pill"
            onClick={() => navigate(mode === "login" ? "/auth/register" : "/auth/login")}
          >
            {mode === "login" ? "Login" : "Register"}
          </button>
        </div>
        {mode === "login" ? <LoginForm onLogin={onLogin} /> : <RegisterForm onLogin={onLogin} />}
      </div>
    </div>
  );
}