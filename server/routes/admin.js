import express from "express";
import crypto from "crypto";
import User from "../models/User.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import { clientIp } from "../utils/request.js";
import { decryptDefaultMpin } from "../utils/mpin.js";
import { checkLimit, RATE } from "../utils/rateLimit.js";

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

export default router;
