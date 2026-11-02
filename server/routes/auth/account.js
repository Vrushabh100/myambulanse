import express from "express";
import mongoose from "mongoose";
import User from "../../models/User.js";
import { signSession } from "../../utils/tokens.js";
import { createDeviceToken, consumeDeviceToken, revokeDeviceTokens } from "../../utils/deviceToken.js";
import { publicUser, authMiddleware, clientIp } from "../../utils/authShared.js";
import { checkLimit, RATE } from "../../utils/rateLimit.js";

const router = express.Router();

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ ...publicUser(user), recovery: !!req.user.recovery });
  } catch (e) {
    console.error("me error:", e.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.post("/device/login", async (req, res) => {
  try {
    const rl = checkLimit("dev-ip:" + clientIp(req), RATE.AUTH_IP, RATE.WINDOW_MS);
    if (!rl.allowed) return res.status(429).json({ error: "Too many attempts. Try again later." });
    const { deviceToken } = req.body || {};
    const doc = await consumeDeviceToken(deviceToken);
    if (!doc) return res.status(401).json({ error: "Session expired. Please login with your MPIN." });
    const user = await User.findById(doc.userId);
    if (!user) return res.status(401).json({ error: "Session expired. Please login with your MPIN." });
    res.json({ token: signSession(user), user: publicUser(user), deviceToken: await createDeviceToken(user._id, req), auto: true, recovery: false });
  } catch (e) {
    console.error("device login error:", e.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.post("/device/revoke", authMiddleware, async (req, res) => {
  try {
    await revokeDeviceTokens(req.user.id, req.body && req.body.deviceToken);
    res.json({ ok: true });
  } catch (e) {
    console.error("device revoke error:", e.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.post("/auto", (req, res) => res.status(410).json({ error: "MPINRequired", message: "Auto-login by network is no longer supported. Please login with your MPIN." }));

router.put("/me/doctor", authMiddleware, async (req, res) => {
  try {
    const { personalDoctor } = req.body || {};
    if (personalDoctor != null && (typeof personalDoctor !== "object" || Array.isArray(personalDoctor))) {
      return res.status(400).json({ error: "Invalid doctor details" });
    }
    const d = personalDoctor || {};
    const doc = {
      name: String(d.name || "").slice(0, 80),
      degree: String(d.degree || "").slice(0, 40),
      specialization: String(d.specialization || "").slice(0, 60),
      mobile: String(d.mobile || "").replace(/\D/g, "").slice(0, 10),
      doctorId: null
    };
    // Resolve doctorId from a registered doctor (by explicit id, else by mobile)
    if (d.doctorId && mongoose.Types.ObjectId.isValid(d.doctorId)) {
      const target = await User.findOne({ _id: d.doctorId, role: "doctor" }).select("_id");
      if (target) doc.doctorId = target._id;
    }
    if (!doc.doctorId && doc.mobile) {
      const target = await User.findOne({ role: "doctor", mobile: doc.mobile }).select("_id");
      if (target) doc.doctorId = target._id;
    }
    const user = await User.findByIdAndUpdate(req.user.id, { personalDoctor: doc }, { new: true });
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ user: publicUser(user), personalDoctor: user.personalDoctor });
  } catch (e) {
    console.error("set self doctor error:", e.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;