import express from "express";
import User from "../../models/User.js";
import { validateEmergencyContacts } from "../../utils/contacts.js";
import { signSession } from "../../utils/tokens.js";
import { createDeviceToken } from "../../utils/deviceToken.js";
import { clientIp, publicUser, normalizeMobile } from "../../utils/authShared.js";
import { checkLimit, RATE } from "../../utils/rateLimit.js";
import {
  CUSTOMER_CARE, WEAK_MPIN_MESSAGE, SECURITY_QUESTIONS,
  isValidMpinFormat, isStrongMpin, hashSecret, normalizeAnswer,
  generateDefaultMpin, encryptDefaultMpin
} from "../../utils/mpin.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const rl = checkLimit("reg-ip:" + clientIp(req), RATE.REGISTER_IP, RATE.WINDOW_MS);
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  const { mobile, name, role, address, doctorProfile, emergencyContacts, mpin, securityQuestion, answer } = req.body || {};

  const mobileN = normalizeMobile(mobile);
  if (!mobileN) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });

  if (typeof name !== "string" || !name.trim() || name.trim().length > 80) return res.status(400).json({ error: "Name is required" });

  if (!isValidMpinFormat(mpin)) return res.status(400).json({ error: "MPIN must be exactly 6 digits" });

  const mpinClean = mpin.trim();
  if (!isStrongMpin(mpinClean)) return res.status(400).json({ error: WEAK_MPIN_MESSAGE });

  if (typeof securityQuestion !== "string" || !SECURITY_QUESTIONS.includes(securityQuestion)) return res.status(400).json({ error: "Choose a valid security question" });

  if (typeof answer !== "string" || answer.length > 200 || normalizeAnswer(answer).length < 2) return res.status(400).json({ error: "Security answer is required" });

  let defaultMpinEnc;
  try {
    defaultMpinEnc = encryptDefaultMpin(generateDefaultMpin());
  } catch (e) {
    return res.status(503).json({ error: "Account recovery is unavailable. Contact customer care " + CUSTOMER_CARE + "." });
  }

  try {
    if (await User.findOne({ mobile: mobileN }).select("_id")) return res.status(409).json({ error: "Mobile number already registered. Please login." });

    const finalRole = role === "doctor" ? "doctor" : "patient";

    let savedContacts = [];
    let profile;
    if (finalRole === "doctor") {
      const dp = doctorProfile || {};
      profile = {
        degree: String(dp.degree || "").slice(0, 60),
        specialization: String(dp.specialization || "").slice(0, 80),
        clinicAddress: String(dp.clinicAddress || "").slice(0, 200)
      };
    } else {
      const cc = validateEmergencyContacts(emergencyContacts);
      if (cc.error) return res.status(400).json({ error: cc.error });
      savedContacts = cc.contacts || [];
    }

    const mpinHash = await hashSecret(mpinClean);
    const answerHash = await hashSecret(normalizeAnswer(answer));

    const user = await User.create({
      mobile: mobileN,
      name: name.trim(),
      role: finalRole,
      address: String(address || "").slice(0, 300),
      doctorProfile: profile,
      emergencyContacts: savedContacts,
      knownIps: [clientIp(req)],
      lastLoginAt: new Date(),
      mpinHash,
      securityQuestion,
      securityAnswerHash: answerHash,
      defaultMpinEnc,
      mpinSetAt: new Date(),
      securityQuestionUpdatedAt: new Date(),
      needsSecuritySetup: false
    });

    res.status(201).json({
      token: signSession(user),
      user: publicUser(user),
      deviceToken: await createDeviceToken(user._id, req),
      recovery: false
    });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ error: "Mobile number already registered. Please login." });
    console.error("register error:", e.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;