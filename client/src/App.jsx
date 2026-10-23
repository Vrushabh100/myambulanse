import React, { useEffect, useState } from "react";
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
import AmbulanceLoader from "./components/AmbulanceLoader.jsx";

function getVisited() {
  try {
    return localStorage.getItem("ma_visited") === "1";
  } catch {
    return false;
  }
}

function authLanding() {
  return getVisited() ? "/auth/login" : "/auth/register";
}

function Splash() {
  return <AmbulanceLoader sub="Checking your session" />;
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
          <span className="brand-icon"><AmbulanceLoader mini /></span>
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
        <div className="footer-inner">
          <div className="footer-left">
            <span className="foot-brand">© 2026 MyAmbulance</span>
            <div className="footer-links">
              <a href="tel:108">108 Ambulance</a>
              <a href="tel:112">112 Emergency</a>
              <a href="tel:1091">1091 Women</a>
            </div>
          </div>
          <div className="footer-tag">One press. Lights, siren, doctor.</div>
          <div className="footer-social">
            <a href="https://x.com/aiplexofficial" target="_blank" rel="noreferrer" title="X">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://www.linkedin.com/in/aiplexofficial/" target="_blank" rel="noreferrer" title="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452z"/></svg>
            </a>
            <a href="https://www.instagram.com/aiplexofficial" target="_blank" rel="noreferrer" title="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            </a>
            <a href="https://www.youtube.com/@aiplex_official" target="_blank" rel="noreferrer" title="YouTube">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>
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
  const navigate = useNavigate();

  useEffect(() => {
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
        <Route path="/auth/register" element={<AuthPage mode="register" onLogin={handleLogin} />} />
        <Route path="/auth/login" element={<AuthPage mode="login" onLogin={handleLogin} />} />
        <Route path="/auth" element={<Navigate to={authLanding()} replace />} />
        <Route path="*" element={<Navigate to={authLanding()} replace />} />
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
