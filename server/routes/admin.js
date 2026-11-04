import express from "express";
import crypto from "crypto";
import User from "../models/User.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import { clientIp } from "../utils/request.js";
import { decryptDefaultMpin } from "../utils/mpin.js";
import { checkLimit, RATE } from "../utils/rateLimit.js";
import mongoose from "mongoose";

const router = express.Router();

function fingerprint(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex").slice(0, 12);
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function maskName(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 1 ? w : w[0] + "*".repeat(Math.max(3, w.length - 1))))
    .join(" ");
}
async function audit(mobile, req, result, key) {
  try {
    await AdminAuditLog.create({
      mobile: mobile || "",
      adminRef: key ? fingerprint(key) : "none",
      ip: clientIp(req),
      at: new Date(),
      result
    });
  } catch {
    /* never fail the request because auditing failed */
  }
}

router.get("/user/:mobile", async (req, res) => {
  const mobile = String(req.params.mobile || "").trim();
  const provided = req.headers["x-admin-key"];
  const expected = process.env.ADMIN_API_KEY;
  try {
    const rl = checkLimit("admin-ip:" + clientIp(req), RATE.ADMIN_IP, 60 * 1000);
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      await audit(mobile, req, "denied", provided);
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    if (!expected) {
      await audit(mobile, req, "denied", provided);
      return res.status(503).json({ error: "Admin access is not configured." });
    }
    if (!safeEqual(provided, expected)) {
      await audit(mobile, req, "denied", provided);
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      await audit(mobile, req, "not_found");
      return res.status(400).json({ error: "Enter a valid 10-digit mobile number" });
    }
    const user = await User.findOne({ mobile }).select("+defaultMpinEnc");
    if (!user) {
      await audit(mobile, req, "not_found");
      return res.status(404).json({ error: "Mobile number not registered." });
    }
    if (!user.defaultMpinEnc) {
      await audit(mobile, req, "found");
      return res.status(409).json({ error: "Default MPIN not set for this account." });
    }
    let defaultMpin;
    try {
      defaultMpin = decryptDefaultMpin(user.defaultMpinEnc);
    } catch (e) {
      console.error("admin decrypt error:", e.message);
      await audit(mobile, req, "found");
      return res.status(503).json({ error: "Account recovery is unavailable. Contact customer care." });
    }
    await audit(mobile, req, "found");
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      mobile: user.mobile,
      name: maskName(user.name),
      role: user.role,
      defaultMpin,
      mpinBlocked: !!user.mpinBlocked,
      accountCreatedAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    });
  } catch (e) {
    console.error("admin error:", e.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

function adminGuard(req, res, next) {
  const provided = req.headers["x-admin-key"];
  const expected = process.env.ADMIN_API_KEY;
  const rl = checkLimit("admin-ip:" + clientIp(req), RATE.ADMIN_IP, 60 * 1000);
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }
  if (!expected) return res.status(503).json({ error: "Admin access is not configured." });
  if (!safeEqual(provided, expected)) return res.status(401).json({ error: "Unauthorized" });
  req.adminKey = provided;
  next();
}

function doctorLite(d) {
  return {
    id: d._id,
    mobile: d.mobile,
    name: d.name,
    address: d.address || "",
    degree: d.doctorProfile?.degree || "",
    specialization: d.doctorProfile?.specialization || "",
    clinicAddress: d.doctorProfile?.clinicAddress || "",
    approvalStatus: d.approvalStatus || "approved",
    approvalNote: d.approvalNote || "",
    suspendUntil: d.suspendUntil || null,
    warnings: d.warnings || [],
    reviewedAt: d.reviewedAt || null,
    lastLoginAt: d.lastLoginAt || null,
    createdAt: d.createdAt
  };
}

router.get("/doctors/pending", adminGuard, async (req, res) => {
  try {
    const list = await User.find({ role: "doctor", approvalStatus: "pending" }).sort({ createdAt: 1 }).limit(200);
    await audit("", req, "list", req.adminKey);
    res.setHeader("Cache-Control", "no-store");
    res.json(list.map(doctorLite));
  } catch (e) {
    console.error("admin pending error:", e.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.get("/doctors/approved", adminGuard, async (req, res) => {
  try {
    const list = await User.find({ role: "doctor", approvalStatus: { $in: ["approved", "suspended", "banned"] } })
      .sort({ reviewedAt: -1, createdAt: -1 })
      .limit(300);
    await audit("", req, "list", req.adminKey);
    res.setHeader("Cache-Control", "no-store");
    res.json(list.map(doctorLite));
  } catch (e) {
    console.error("admin approved error:", e.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.get("/doctors/:id", adminGuard, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid doctor id" });
    const d = await User.findOne({ _id: req.params.id, role: "doctor" });
    if (!d) return res.status(404).json({ error: "Doctor not found" });
    await audit(d.mobile, req, "found", req.adminKey);
    res.setHeader("Cache-Control", "no-store");
    res.json(doctorLite(d));
  } catch (e) {
    console.error("admin doctor detail error:", e.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

async function mutateDoctor(req, res, action, changes, auditResult) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid doctor id" });
    const d = await User.findOne({ _id: req.params.id, role: "doctor" });
    if (!d) return res.status(404).json({ error: "Doctor not found" });
    const updated = await User.findByIdAndUpdate(req.params.id, changes, { new: true });
    await audit(d.mobile, req, auditResult, req.adminKey);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, doctor: doctorLite(updated) });
  } catch (e) {
    console.error("admin mutate error:", e.message);
    res.status(500).json({ error: "Something went wrong." });
  }
}

router.post("/doctors/:id/approve", adminGuard, (req, res) =>
  mutateDoctor(req, res, "approve", { $set: { approvalStatus: "approved", reviewedAt: new Date(), suspendUntil: null, approvalNote: "" } }, "approve")
);

router.post("/doctors/:id/decline", adminGuard, (req, res) => {
  const note = String((req.body && req.body.note) || "").slice(0, 300);
  return mutateDoctor(req, res, "decline", { $set: { approvalStatus: "declined", reviewedAt: new Date(), approvalNote: note } }, "decline");
});

router.post("/doctors/:id/suspend", adminGuard, (req, res) => {
  const months = Math.min(24, Math.max(1, parseInt((req.body && req.body.months) || "1", 10) || 1));
  const until = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
  const note = String((req.body && req.body.note) || "").slice(0, 300);
  return mutateDoctor(req, res, "suspend", { $set: { approvalStatus: "suspended", suspendUntil: until, reviewedAt: new Date(), approvalNote: note } }, "suspend");
});

router.post("/doctors/:id/ban", adminGuard, (req, res) => {
  const note = String((req.body && req.body.note) || "").slice(0, 300);
  return mutateDoctor(req, res, "ban", { $set: { approvalStatus: "banned", reviewedAt: new Date(), suspendUntil: null, approvalNote: note } }, "ban");
});

router.post("/doctors/:id/warn", adminGuard, (req, res) => {
  const note = String((req.body && req.body.note) || "").trim().slice(0, 300);
  if (!note) return res.status(400).json({ error: "A warning note is required" });
  return mutateDoctor(req, res, "warn", { $push: { warnings: { note, at: new Date() } }, $set: { approvalNote: note } }, "warn");
});

router.post("/doctors/:id/unsuspend", adminGuard, (req, res) =>
  mutateDoctor(req, res, "unsuspend", { $set: { approvalStatus: "approved", suspendUntil: null, reviewedAt: new Date() } }, "unsuspend")
);
export default router;
