import express from "express";
import User from "../../models/User.js";
import { signSession } from "../../utils/tokens.js";
import { createDeviceToken } from "../../utils/deviceToken.js";
import { publicUser, normalizeMobile, normalizeMpin, authRateLimit } from "../../utils/authShared.js";
import { checkLimit, RATE } from "../../utils/rateLimit.js";
import {
  CUSTOMER_CARE, LOCK_BREAK_ATTEMPTS, LOCK_SECONDS,
  verifySecret, burnScrypt, safeEqualStr, applyLockPolicy, decryptDefaultMpin
} from "../../utils/mpin.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { mobile, mpin } = req.body || {};
    const mobileN = normalizeMobile(mobile);
    if (!mobileN) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });
    if (!normalizeMpin(mpin)) return res.status(400).json({ error: "MPIN must be exactly 6 digits" });
    if (authRateLimit(req, res, mobileN)) return;

    const user = await User.findOne({ mobile: mobileN }).select("+mpinHash +defaultMpinEnc");
    if (!user) {
      await burnScrypt();
      return res.status(401).json({ error: "Incorrect mobile number or MPIN." });
    }

    const now = new Date();
    const supplied = mpin.trim();
    const locked = !!(user.lockUntil && user.lockUntil > now);
    const blocked = !!user.mpinBlocked;

    if (locked && !blocked) {
      const sec = Math.max(1, Math.ceil((user.lockUntil - now) / 1000));
      return res.status(429).json({
        error: "Too many wrong attempts. Try again in " + sec + " seconds. Need help? Call customer care " + CUSTOMER_CARE + ".",
        lockSeconds: sec
      });
    }

    let personalOk = false;
    if (!blocked && user.mpinHash) personalOk = await verifySecret(supplied, user.mpinHash);
    if (personalOk) {
      await User.updateOne({ _id: user._id }, { $set: { failedMpinAttempts: 0, failedAnswerAttempts: 0, lockUntil: null, mpinBlocked: false, answerBlocked: false, lastLoginAt: now } });
      return res.json({ token: signSession(user), user: publicUser(user), deviceToken: await createDeviceToken(user._id, req), recovery: false });
    }

    if (blocked) {
      const r = checkLimit("default:" + mobileN, RATE.DEFAULT_MOBILE, RATE.DEFAULT_WINDOW_MS);
      if (!r.allowed) return res.status(429).json({
        error: "Too many recovery attempts. Try again in " + r.retryAfterSec + " seconds. Need help? Call customer care " + CUSTOMER_CARE + ".",
        retryAfter: r.retryAfterSec
      });
    }

    let defaultOk = false;
    if (user.defaultMpinEnc) {
      try {
        defaultOk = safeEqualStr(supplied, decryptDefaultMpin(user.defaultMpinEnc));
      } catch (e) {
        console.error("default mpin decrypt failed:", e.message);
      }
    }
    if (defaultOk) {
      await User.updateOne({ _id: user._id }, { $set: { failedMpinAttempts: 0, failedAnswerAttempts: 0, lockUntil: null, mpinBlocked: false, answerBlocked: false, lastLoginAt: now } });
      return res.json({ token: signSession(user, { recovery: true }), user: publicUser(user), deviceToken: await createDeviceToken(user._id, req), recovery: true, mustChangeSecurity: true });
    }

    if (blocked) return res.status(423).json({ error: "Account locked for your safety. Please call customer care " + CUSTOMER_CARE + " for account recovery.", blocked: true });

    const bumped = await User.findOneAndUpdate({ _id: user._id }, { $inc: { failedMpinAttempts: 1 } }, { new: true });
    const count = (bumped && bumped.failedMpinAttempts) || 1;
    const policy = applyLockPolicy(count, now);
    if (policy.blocked) await User.updateOne({ _id: user._id }, { $set: { mpinBlocked: true, lockUntil: null } });
    else if (policy.lockUntil) await User.updateOne({ _id: user._id }, { $set: { lockUntil: policy.lockUntil } });

    if (policy.blocked) return res.status(423).json({ error: "Account locked for your safety. Please call customer care " + CUSTOMER_CARE + " for account recovery.", blocked: true });
    if (policy.lockUntil) return res.status(429).json({ error: "Too many wrong attempts. Try again in " + LOCK_SECONDS + " seconds. Need help? Call customer care " + CUSTOMER_CARE + ".", lockSeconds: LOCK_SECONDS });
    return res.status(401).json({ error: "Incorrect mobile number or MPIN.", attemptsLeft: LOCK_BREAK_ATTEMPTS - (count % LOCK_BREAK_ATTEMPTS) });
  } catch (e) {
    console.error("login error:", e.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;