import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { validateEmergencyContacts } from "../utils/contacts.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "myambulance-dev-secret-change-in-prod";
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("FATAL: JWT_SECRET is required in production (set it in the environment).");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.warn("WARNING: using the development JWT secret — set JWT_SECRET before deploying.");
}
const MAX_KNOWN_IPS = 6;

function sign(user) {
  return jwt.sign(
    { id: user._id, mobile: user.mobile, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "180d" }
  );
}

export function clientIp(req) {
  const forwarded = process.env.TRUST_PROXY === "1" ? req.headers["x-forwarded-for"] : "";
  let ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : "") || req.socket?.remoteAddress || "";
  ip = String(ip).trim();
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1" || ip === "127.0.0.1") ip = "127.0.0.1";
  return ip;
}

function dedupeIps(list, ip) {
  const arr = Array.isArray(list) ? list.filter((x) => typeof x === "string" && x) : [];
  const next = ip ? [ip, ...arr.filter((x) => x !== ip)] : arr;
  return next.slice(0, MAX_KNOWN_IPS);
}

function rememberIp(user, ip) {
  User.updateOne(
    { _id: user._id },
    {
      $set: { lastLoginAt: new Date() },
      $push: { knownIps: { $each: [ip], $position: 0, $slice: MAX_KNOWN_IPS } }
    }
  ).catch(() => {});
}

export function publicUser(u) {
  return {
    id: u._id,
    mobile: u.mobile,
    name: u.name,
    role: u.role,
    address: u.address,
    doctorProfile: u.doctorProfile,
    emergencyContacts: u.emergencyContacts || []
  };
}

function validMobile(m) {
  return typeof m === "string" && /^[6-9]\d{9}$/.test(m.trim());
}

router.post("/register", async (req, res) => {
  try {
    const { mobile, name, role, address, doctorProfile, emergencyContacts } = req.body;
    if (!validMobile(mobile)) {
      return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const exists = await User.findOne({ mobile: mobile.trim() });
    if (exists) {
      return res.status(409).json({ error: "Mobile number already registered. Please login." });
    }
    const finalRole = role === "doctor" ? "doctor" : "patient";
    let savedContacts = [];
    if (finalRole !== "doctor") {
      const contactCheck = validateEmergencyContacts(emergencyContacts);
      if (contactCheck.error) return res.status(400).json({ error: contactCheck.error });
      savedContacts = contactCheck.contacts || [];
    }
    const ip = clientIp(req);
    const user = await User.create({
      mobile: mobile.trim(),
      name: name.trim(),
      role: finalRole,
      address: address || "",
      doctorProfile: doctorProfile || undefined,
      emergencyContacts: savedContacts,
      knownIps: dedupeIps([], ip),
      lastLoginAt: new Date()
    });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!validMobile(mobile)) {
      return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });
    }
    const user = await User.findOne({ mobile: mobile.trim() });
    if (!user) {
      return res.status(404).json({ error: "Mobile number not registered. Please register first." });
    }
    rememberIp(user, clientIp(req));
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/auto", async (req, res) => {
  try {
    const { mobile } = req.body || {};
    if (!validMobile(mobile)) {
      return res.status(404).json({ error: "Mobile number not registered" });
    }
    const user = await User.findOne({ mobile: mobile.trim() });
    if (!user) {
      return res.status(404).json({ error: "Mobile number not registered" });
    }
    const ip = clientIp(req);
    const ips = Array.isArray(user.knownIps) ? user.knownIps : [];
    if (!ip || !ips.includes(ip)) {
      return res.status(401).json({ error: "ip_mismatch" });
    }
    rememberIp(user, ip);
    res.json({ token: sign(user), user: publicUser(user), auto: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/me", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json(publicUser(user));
  } catch {
    res.status(401).json({ error: "Session expired. Please login again." });
  }
});

export function trackIp(req) {
  try {
    const id = req.user?.id;
    const ip = req.clientIp || clientIp(req);
    if (!id || !ip) return;
    User.updateOne(
      { _id: id, knownIps: { $ne: ip } },
      { $push: { knownIps: { $each: [ip], $position: 0, $slice: MAX_KNOWN_IPS } } }
    ).catch(() => {});
  } catch {
    // fire-and-forget
  }
}

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    req.clientIp = clientIp(req);
    trackIp(req);
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please login again." });
  }
}

export default router;
