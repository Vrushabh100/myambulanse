import crypto from "crypto";
import express from "express";
import User from "../../models/User.js";
import { signSession, signReset, verifyToken } from "../../utils/tokens.js";
import { createDeviceToken } from "../../utils/deviceToken.js";
import { publicUser, authMiddleware, normalizeMobile, normalizeMpin, authRateLimit } from "../../utils/authShared.js";
import { checkLimit, RATE } from "../../utils/rateLimit.js";
import {
  CUSTOMER_CARE, SECURITY_QUESTIONS, LOCK_BREAK_ATTEMPTS, LOCK_SECONDS,
  isValidMpinFormat, isStrongMpin, WEAK_MPIN_MESSAGE,
  hashSecret, verifySecret, burnScrypt, normalizeAnswer, applyLockPolicy
} from "../../utils/mpin.js";

const router = express.Router();

function lockSecondsLeft(lockUntil, now) {
  return Math.max(1, Math.ceil((lockUntil - now) / 1000));
}

function lockMessage(sec) {
  return "Too many wrong attempts. Please try again in " + sec + " seconds. Need help? Call customer care " + CUSTOMER_CARE + ".";
}

const ANSWER_BLOCK_MESSAGE = "Answer attempt limit reached. Please call customer care " + CUSTOMER_CARE + " for account recovery.";
const RECOVERY_ONLY_MESSAGE = "This option is available only after logging in with your default MPIN.";
const RESET_EXPIRED_MESSAGE = "Reset link expired. Please start again.";

router.get("/mpin/questions", (req, res) => {
  res.json({ questions: SECURITY_QUESTIONS });
});

router.post("/mpin/forgot/start", async (req, res) => {
  try {
    const { mobile } = req.body || {};
    const mobileN = normalizeMobile(mobile);
    if (!mobileN) return res.status(400).json({ error: "Enter a valid mobile number" });
    if (authRateLimit(req, res, mobileN)) return;

    const user = await User.findOne({ mobile: mobileN }).select("+securityQuestion");
    if (!user) {
      return res.status(404).json({
        error: "Mobile number not registered. Please register first.",
        customerCare: CUSTOMER_CARE
      });
    }

    const now = new Date();
    if (user.lockUntil && user.lockUntil > now) {
      const sec = lockSecondsLeft(user.lockUntil, now);
      return res.status(429).json({
        error: lockMessage(sec),
        lockSeconds: sec,
        customerCare: CUSTOMER_CARE
      });
    }

    if (user.answerBlocked) {
      return res.json({ question: null, blocked: true, customerCare: CUSTOMER_CARE });
    }

    if (!user.securityQuestion) {
      return res.status(409).json({
        error: "Recovery is not set up for this account. Please call customer care " + CUSTOMER_CARE + ".",
        customerCare: CUSTOMER_CARE
      });
    }

    return res.json({
      question: user.securityQuestion,
      blocked: false,
      customerCare: CUSTOMER_CARE,
      needsSecuritySetup: !!user.needsSecuritySetup
    });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.post("/mpin/forgot/verify", async (req, res) => {
  try {
    const { mobile, answer } = req.body || {};
    const mobileN = normalizeMobile(mobile);
    if (!mobileN) return res.status(400).json({ error: "Enter a valid mobile number" });
    if (typeof answer !== "string" || answer.length > 200 || normalizeAnswer(answer).length < 1) {
      return res.status(400).json({ error: "Enter your answer" });
    }
    if (authRateLimit(req, res, mobileN)) return;

    const user = await User.findOne({ mobile: mobileN }).select("+securityAnswerHash");
    if (!user) {
      await burnScrypt();
      return res.status(401).json({ error: "Incorrect answer. Please try again." });
    }

    if (user.answerBlocked) {
      return res.status(423).json({ error: ANSWER_BLOCK_MESSAGE, blocked: true });
    }

    const now = new Date();
    if (user.lockUntil && user.lockUntil > now) {
      const sec = lockSecondsLeft(user.lockUntil, now);
      return res.status(429).json({ error: lockMessage(sec), lockSeconds: sec });
    }

    const ok = user.securityAnswerHash
      ? await verifySecret(normalizeAnswer(answer), user.securityAnswerHash)
      : false;

    if (ok) {
      await User.updateOne(
        { _id: user._id },
        { $set: { failedAnswerAttempts: 0, answerBlocked: false, lockUntil: null } }
      );
      const nonce = crypto.randomBytes(16).toString("hex");
      await User.updateOne({ _id: user._id }, { $set: { resetNonce: nonce } });
      return res.json({ resetToken: signReset(user, nonce), expiresIn: 600 });
    }

    const bumped = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { failedAnswerAttempts: 1 } },
      { new: true }
    );
    const count = bumped.failedAnswerAttempts;
    const policy = applyLockPolicy(count, now);
    if (policy.blocked) {
      await User.updateOne({ _id: user._id }, { $set: { answerBlocked: true, lockUntil: null } });
    } else if (policy.lockUntil) {
      await User.updateOne({ _id: user._id }, { $set: { lockUntil: policy.lockUntil } });
    }

    if (policy.blocked) {
      return res.status(423).json({ error: ANSWER_BLOCK_MESSAGE, blocked: true });
    }
    if (policy.lockUntil) {
      const sec = lockSecondsLeft(policy.lockUntil, now);
      return res.status(429).json({ error: lockMessage(sec), lockSeconds: sec });
    }
    return res.status(401).json({
      error: "Incorrect answer. Please try again.",
      attemptsLeft: LOCK_BREAK_ATTEMPTS - (count % LOCK_BREAK_ATTEMPTS)
    });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.post("/mpin/set", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    let payload;
    try {
      payload = verifyToken(token, "reset");
    } catch {
      return res.status(401).json({ error: RESET_EXPIRED_MESSAGE });
    }

    const { newMpin } = req.body || {};
    if (!isValidMpinFormat(newMpin)) return res.status(400).json({ error: "MPIN must be exactly 6 digits" });
    const clean = newMpin.trim();
    if (!isStrongMpin(clean)) return res.status(400).json({ error: WEAK_MPIN_MESSAGE });

    const user = await User.findById(payload.id).select("+resetNonce");
    if (!user) return res.status(401).json({ error: RESET_EXPIRED_MESSAGE });

    if (!user.resetNonce || !payload.rn || payload.rn !== user.resetNonce) {
      return res.status(401).json({ error: "Reset link already used. Please start again." });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetNonce: null,
          mpinHash: await hashSecret(clean),
          mpinSetAt: new Date(),
          failedMpinAttempts: 0,
          failedAnswerAttempts: 0,
          lockUntil: null,
          mpinBlocked: false,
          answerBlocked: false
        }
      }
    );
    const fresh = await User.findById(user._id);
    return res.json({
      ok: true,
      token: signSession(fresh),
      user: publicUser(fresh),
      deviceToken: await createDeviceToken(fresh._id, req),
      recovery: false
    });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.post("/mpin/recovery/update-question", authMiddleware, async (req, res) => {
  try {
    if (!req.user.recovery) return res.status(403).json({ error: RECOVERY_ONLY_MESSAGE });

    const { securityQuestion, answer } = req.body || {};
    if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
      return res.status(400).json({ error: "Choose a valid security question" });
    }
    if (
      typeof answer !== "string" ||
      answer.length > 200 ||
      normalizeAnswer(answer).length < 2
    ) {
      return res.status(400).json({ error: "Security answer is required" });
    }

    await User.updateOne(
      { _id: req.user.id },
      {
        $set: {
          securityQuestion,
          securityAnswerHash: await hashSecret(normalizeAnswer(answer)),
          securityQuestionUpdatedAt: new Date(),
          needsSecuritySetup: false,
          failedAnswerAttempts: 0,
          answerBlocked: false
        }
      }
    );
    const fresh = await User.findById(req.user.id);
    return res.json({ ok: true, user: publicUser(fresh) });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

router.post("/mpin/recovery/set-mpin", authMiddleware, async (req, res) => {
  try {
    if (!req.user.recovery) return res.status(403).json({ error: RECOVERY_ONLY_MESSAGE });

    const { newMpin } = req.body || {};
    if (!isValidMpinFormat(newMpin)) return res.status(400).json({ error: "MPIN must be exactly 6 digits" });
    const clean = newMpin.trim();
    if (!isStrongMpin(clean)) return res.status(400).json({ error: WEAK_MPIN_MESSAGE });

    await User.updateOne(
      { _id: req.user.id },
      {
        $set: {
          mpinHash: await hashSecret(clean),
          mpinSetAt: new Date(),
          failedMpinAttempts: 0,
          failedAnswerAttempts: 0,
          lockUntil: null,
          mpinBlocked: false,
          answerBlocked: false
        }
      }
    );
    const fresh = await User.findById(req.user.id);
    return res.json({
      ok: true,
      token: signSession(fresh),
      user: publicUser(fresh),
      deviceToken: await createDeviceToken(fresh._id, req),
      recovery: false
    });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;