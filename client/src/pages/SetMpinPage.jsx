import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, setSession, saveDeviceToken, setRecovery, getRecovery } from "../api.js";
import MpinInput from "../components/MpinInput.jsx";
import { SECURITY_QUESTIONS } from "../constants/securityQuestions.js";

const WEAK = "MPIN must be 6 digits and must not be 000000, 111111, 123456, 654321, or a repeated/sequential number";
function weakMpin(s){ if(!/^\d{6}$/.test(s)) return true; const bad=["000000","111111","123456","654321"]; if(bad.includes(s)) return true; if(s.split("").every(c=>c===s[0])) return true; let asc=true,desc=true; for(let i=1;i<6;i++){const a=s.charCodeAt(i-1),b=s.charCodeAt(i); if(b!==a+1)asc=false; if(b!==a-1)desc=false;} if(asc||desc)return true; const pat=(n)=>{const p=s.slice(0,n); for(let i=n;i<6;i+=n) if(s.slice(i,i+n)!==p) return false; return true;}; if(pat(2)||pat(3))return true; if(s[0]===s[1]&&s[2]===s[3]&&s[4]===s[5])return true; return false; }
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
async function postWithToken(path, token, body){ const r=await fetch(`${API_BASE}/api${path}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(body)}); const d=await r.json().catch(()=>({})); if(!r.ok){const e=new Error(d.error||`Request failed (${r.status})`); e.status=r.status; throw e;} return d; }

export default function SetMpinPage({ user, onAuthed }) {
  const navigate = useNavigate();
  const recoveryQuery = new URLSearchParams(useLocation().search).get("recovery") === "1";
  const recoveryMode = recoveryQuery || (!!user && getRecovery());
  const resetToken = (typeof sessionStorage !== "undefined" && sessionStorage.getItem("ma_reset_token")) || "";
  const [newMpin,setNewMpin]=useState(""); const [confirm,setConfirm]=useState("");
  const [question,setQuestion]=useState(SECURITY_QUESTIONS[0]); const [answer,setAnswer]=useState("");
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [doneMsg,setDoneMsg]=useState("");
  const [questions,setQuestions]=useState(SECURITY_QUESTIONS);
  useEffect(()=>{ api("/auth/mpin/questions").then(d=>{ if(d&&Array.isArray(d.questions)&&d.questions.length) setQuestions(d.questions); }).catch(()=>{}); },[]);
  useEffect(()=>{ if(!recoveryMode && !resetToken) navigate("/login/mpin/forgotmpin",{replace:true}); },[recoveryMode,resetToken,navigate]);
  function validate(){ if(!/^\d{6}$/.test(newMpin)){setError("MPIN must be exactly 6 digits.");return false;} if(weakMpin(newMpin)){setError(WEAK);return false;} if(newMpin!==confirm){setError("MPIN and confirm MPIN do not match.");return false;} setError(""); return true; }
  async function resetSubmit(e){ e.preventDefault(); if(!validate())return; setBusy(true); try{ const data=await postWithToken("/auth/mpin/set",resetToken,{newMpin}); sessionStorage.removeItem("ma_reset_token"); setSession(data.token,data.user); if(data.deviceToken) saveDeviceToken(data.deviceToken); setRecovery(false); if(onAuthed) onAuthed(data.user,false); navigate("/",{replace:true}); }catch(err){ setError(err.message||"Something went wrong."); } finally{ setBusy(false);} }
  async function recoveryMpinSubmit(e){ e.preventDefault(); if(!validate())return; setBusy(true); try{ const data=await api("/auth/mpin/recovery/set-mpin",{method:"POST",body:{newMpin}}); setSession(data.token,data.user); if(data.deviceToken) saveDeviceToken(data.deviceToken); setRecovery(false); if(onAuthed) onAuthed(data.user,false); navigate("/",{replace:true}); }catch(err){ setError(err.message||"Something went wrong."); } finally{ setBusy(false);} }
  async function questionSubmit(e){ e.preventDefault(); if(answer.trim().length<2){setError("Enter your security answer.");return;} setBusy(true); setError(""); try{ await api("/auth/mpin/recovery/update-question",{method:"POST",body:{securityQuestion:question,answer}}); setDoneMsg("Security question and answer updated."); }catch(err){ setError(err.message||"Something went wrong."); } finally{ setBusy(false);} }
  const mpinFields = (<><label>New MPIN</label><MpinInput value={newMpin} onChange={setNewMpin} disabled={busy} autoFocus /><label>Confirm MPIN</label><MpinInput value={confirm} onChange={setConfirm} disabled={busy} /></>);
  return (<div className="auth-wrap"><div className="card auth-card">
    <h2>Set MPIN</h2>
    {error && <div className="error">{error}</div>}
    {doneMsg && <div className="notice">{doneMsg}</div>}
    {recoveryMode ? (<div className="setmpin-grid">
      <div className="card"><h3>Change your security question &amp; answer</h3><div className="notice warn">You logged in with your default MPIN. Please change your recovery question/answer and set a new MPIN.</div><form onSubmit={questionSubmit}><label>Security question</label><select value={question} onChange={(e)=>setQuestion(e.target.value)}>{questions.map((q,i)=><option key={i} value={q}>{q}</option>)}</select><label>Answer</label><input value={answer} onChange={(e)=>setAnswer(e.target.value)} placeholder="Your answer" /><button className="btn primary wide" disabled={busy}>Save security question</button></form></div>
      <div className="card"><h3>Set a new MPIN</h3><form onSubmit={recoveryMpinSubmit}>{mpinFields}<button className="btn primary wide" disabled={busy}>{busy?"Please wait...":"Save new MPIN"}</button></form></div>
    </div>) : (<form onSubmit={resetSubmit}>{mpinFields}<button className="btn primary wide" disabled={busy}>{busy?"Please wait...":"Save new MPIN"}</button></form>)}
    <button type="button" className="skip-link" onClick={()=>navigate("/")}>Skip for now</button>
  </div></div>);
}
