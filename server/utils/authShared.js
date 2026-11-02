import User from "../models/User.js";
import { verifyToken } from "./tokens.js";
import { clientIp as _clientIp } from "./request.js";
import { CUSTOMER_CARE } from "./mpin.js";
import { checkLimit, RATE } from "./rateLimit.js";

const MAX_KNOWN_IPS = 6;

export function clientIp(req) {
  return _clientIp(req);
}

export function publicUser(u) {
  return {
    id: u._id,
    mobile: u.mobile,
    name: u.name,
    role: u.role,
    address: u.address,
    doctorProfile: u.doctorProfile,
    personalDoctor: u.personalDoctor || { name: "", degree: "", specialization: "", mobile: "", doctorId: null },
    emergencyContacts: u.emergencyContacts || [],
    needsSecuritySetup: !!u.needsSecuritySetup
  };
}

function dedupeIps(list, ip) {
  const arr = Array.isArray(list) ? list.filter((x) => typeof x === "string" && x) : [];
  const next = ip ? [ip, ...arr.filter((x) => x !== ip)] : arr;
  return next.slice(0, MAX_KNOWN_IPS);
}

export function trackIp(req) {
  try {
    const id = req.user && req.user.id;
    const ip = req.clientIp || _clientIp(req);
    if (!id || !ip) return;
    User.updateOne(
      { _id: id, knownIps: { $ne: ip } },
      { $push: { knownIps: { $each: [ip], $position: 0, $slice: MAX_KNOWN_IPS } } }
    ).catch(() => {});
  } catch {
    /* fire-and-forget */
  }
}

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    req.user = verifyToken(token, "session");
    req.clientIp = _clientIp(req);
    trackIp(req);
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please login again." });
  }
}

export function normalizeMobile(v) {
  if (typeof v !== "string") return null;
  const m = v.trim();
  return /^[6-9]\d{9}$/.test(m) ? m : null;
}

export function normalizeMpin(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^\d{6}$/.test(s) ? s : null;
}

export function authRateLimit(req, res, mobile) {
  const ip = _clientIp(req);
  const checks = [
    checkLimit("auth-ip:" + ip, RATE.AUTH_IP, RATE.WINDOW_MS),
    checkLimit("auth-mobile:" + mobile, RATE.AUTH_MOBILE, RATE.WINDOW_MS)
  ];
  for (const r of checks) {
    if (!r.allowed) {
      res.status(429).json({
        error:
          "Too many attempts. Try again in " +
          r.retryAfterSec +
          " seconds. Need help? Call customer care " +
          CUSTOMER_CARE +
          ".",
        lockSeconds: r.retryAfterSec
      });
      return true;
    }
  }
  return false;
}

export { MAX_KNOWN_IPS, dedupeIps };