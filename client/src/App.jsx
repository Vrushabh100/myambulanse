import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from "react-router-dom";
import AuthPage from "./pages/AuthPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import PatientsPage from "./pages/PatientsPage.jsx";
import VehiclesPage from "./pages/VehiclesPage.jsx";
import DoctorPage from "./pages/DoctorPage.jsx";
import {
  api,
  isHttpError,
  getToken,
  setSession,
  clearSession,
  saveMobile,
  getSavedMobile,
  clearSavedMobile
} from "./api.js";

function Splash() {
  return (
    <div className="splash">
      <div className="splash-logo">🚑</div>
      <div className="splash-title">MyAmbulance...</div>
      <div className="splash-sub">Checking your session</div>
    </div>
  );
}

function Shell({ user, onLogout, children }) {
  const location = useLocation();
  const isDoctor = user.role === "doctor";
  const tabs = isDoctor
    ? [
        { to: "/doctor", label: "Emergency Console" },
        { to: "/profile", label: "Profile" }
      ]
    : [
        { to: "/", label: "SOS Dashboard" },
        { to: "/patients", label: "My Patients" },
        { to: "/vehicles", label: "Emergency Vehicles" },
        { to: "/doctor", label: "Doctor Console" },
        { to: "/profile", label: "Profile" }
      ];
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🚑</span>
          <div>
            <div className="brand-name">MyAmbulance</div>
            <div className="brand-sub">One press. Lights, siren, doctor.</div>
          </div>
        </div>
        <nav className="tabs">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className={
                location.pathname === t.to || (t.to === "/" && location.pathname === "")
                  ? "tab active"
                  : "tab"
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="userbox">
          <div className="user-meta">
            <b>{user.name}</b>
            <small>
              {user.mobile} · {isDoctor ? "Doctor" : "Patient"}
            </small>
          </div>
          <button className="btn ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
      <footer className="footer">
        <div>
          <span className="foot-brand">MyAmbulance</span> · Convert your private car into an
          emergency ambulance
        </div>
        <div className="helplines">
          <a href="tel:108">Ambulance 108</a>
          <a href="tel:112">National Emergency 112</a>
          <a href="tel:1091">Women Helpline 1091</a>
        </div>
      </footer>
    </div>
  );
}

function ProfilePage({ user, onLogout }) {
  return (
    <>
      <div className="eyebrow">Account</div>
      <div className="card">
        <h2>Profile</h2>
        <table className="kv">
          <tbody>
            <tr>
              <td>Name</td>
              <td>{user.name}</td>
            </tr>
            <tr>
              <td>Mobile</td>
              <td>{user.mobile}</td>
            </tr>
            <tr>
              <td>Role</td>
              <td style={{ textTransform: "capitalize" }}>{user.role}</td>
            </tr>
            <tr>
              <td>Address</td>
              <td>{user.address || "—"}</td>
            </tr>
            {user.role === "doctor" && (
              <>
                <tr>
                  <td>Degree</td>
                  <td>{user.doctorProfile?.degree || "—"}</td>
                </tr>
                <tr>
                  <td>Specialization</td>
                  <td>{user.doctorProfile?.specialization || "—"}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        <div className="info-ok">
          <span>✅</span>
          <span>Auto-login active on this network — you won't be asked to log in again from here.</span>
        </div>
        <div className="row-actions">
          <button className="btn danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const booted = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    let cancelled = false;

    (async () => {
      const token = getToken();
      if (token) {
        try {
          const me = await api("/auth/me");
          const u = me && me.user ? me.user : me;
          if (cancelled) return;
          setSession(token, u);
          setUser(u);
          setBooting(false);
          return;
        } catch (e) {
          if (cancelled) return;
          if (!isHttpError(e)) {
            // Timeout or network failure: the server never answered, so the stored
            // session may still be valid. Keep storage and finish booting so the
            // user can retry instead of being kicked to login.
            setBooting(false);
            return;
          }
          // Real auth error from the server (expired token, user not found, ...).
          clearSession();
        }
      }
      if (cancelled) return;
      const mobile = getSavedMobile();
      if (mobile) {
        try {
          const data = await api("/auth/auto", { method: "POST", body: { mobile } });
          if (cancelled) return;
          setSession(data.token, data.user);
          saveMobile(mobile);
          setUser(data.user);
          setBooting(false);
          return;
        } catch (e) {
          if (cancelled) return;
          if (!isHttpError(e)) {
            // Timeout or network failure: keep the saved mobile so the next load
            // can auto-login again once the server is reachable.
            setBooting(false);
            return;
          }
          // Server answered: only clear saved mobile on real rejections
          // (401 ip_mismatch, 404 not registered, ...).
          clearSession();
          clearSavedMobile();
        }
      }
      if (!cancelled) setBooting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = (u) => {
    setUser(u);
  };

  const handleLogout = () => {
    clearSession();
    clearSavedMobile();
    setUser(null);
    navigate("/auth", { replace: true });
  };

  if (booting) return <Splash />;

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Shell user={user} onLogout={handleLogout}>
      <Routes>
        <Route
          path="/"
          element={user.role === "doctor" ? <Navigate to="/doctor" replace /> : <Dashboard user={user} />}
        />
        <Route path="/patients" element={<PatientsPage user={user} />} />
        <Route path="/vehicles" element={<VehiclesPage user={user} />} />
        <Route path="/doctor" element={<DoctorPage user={user} />} />
        <Route path="/profile" element={<ProfilePage user={user} onLogout={handleLogout} />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
