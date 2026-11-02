#!/usr/bin/env node
/**
 * MyAmbulance legacy MPIN backfill (idempotent, safe to re-run).
 *
 * Usage (from the server/ directory):
 *   node --env-file=.env migrate-mpin.mjs
 *
 * Only users that have no MPIN yet (missing / null / empty mpinHash) are
 * touched. Accounts that already hold a non-empty mpinHash are excluded by the
 * query and never overwritten. No personal or default MPIN value is ever
 * printed to the console.
 */

import dns from "dns";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "./models/User.js";
import {
  hashSecret,
  normalizeAnswer,
  generateDefaultMpin,
  encryptDefaultMpin
} from "./utils/mpin.js";

// Node's default resolver reads 127.0.0.1 (dead stub on this machine) -> SRV
// queries for mongodb+srv:// get ECONNREFUSED. Force real DNS servers, unless
// we are running on Vercel (same behaviour as server/index.js).
if (!process.env.VERCEL) {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    console.log("DNS servers forced to 8.8.8.8, 1.1.1.1 (Node resolver fix)");
  } catch (e) {
    console.warn("Could not force DNS servers:", e.message);
  }
}

const SECURITY_QUESTION = "What was the model of your first phone?";

// Known demo accounts may be seeded interactively, so they keep a predictable
// personal MPIN ("123456"). The strength check is intentionally bypassed for
// these legacy demo accounts only.
const DEMO_MPIN = "123456";
const DEMO_ANSWER = "myambulance";

const DEMO_PATIENT_MOBILES = Array.from({ length: 10 }, (_, i) => `98220001${String(i + 1).padStart(2, "0")}`);
const DEMO_DOCTOR_MOBILES = Array.from({ length: 5 }, (_, i) => `98220000${String(i + 1).padStart(2, "0")}`);
const DEMO_MOBILES = new Set([...DEMO_PATIENT_MOBILES, ...DEMO_DOCTOR_MOBILES]);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  if (!process.env.DEFAULT_MPIN_ENC_KEY) {
    console.error("DEFAULT_MPIN_ENC_KEY is required to generate default MPINs");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const users = await User.find({
    $or: [
      { mpinHash: { $exists: false } },
      { mpinHash: null },
      { mpinHash: "" }
    ]
  });

  let backfilled = 0;
  let demoBackfilled = 0;

  for (const user of users) {
    const mobile = String(user.mobile || "").trim();
    const isDemo = DEMO_MOBILES.has(mobile);

    const personalMpin = isDemo ? DEMO_MPIN : generateDefaultMpin();
    const answer = isDemo ? DEMO_ANSWER : crypto.randomBytes(16).toString("hex");

    const result = await User.updateOne(
      { _id: user._id },
      {
        $set: {
          mpinHash: await hashSecret(personalMpin),
          securityQuestion: SECURITY_QUESTION,
          securityAnswerHash: await hashSecret(normalizeAnswer(answer)),
          defaultMpinEnc: encryptDefaultMpin(generateDefaultMpin()),
          mpinSetAt: new Date(),
          securityQuestionUpdatedAt: new Date(),
          needsSecuritySetup: !isDemo,
          mpinBlocked: !isDemo,
          failedMpinAttempts: 0,
          failedAnswerAttempts: 0,
          lockUntil: null,
          answerBlocked: false
        }
      }
    );

    const matched = result.matchedCount ?? result.n ?? 0;
    if (matched) {
      backfilled += 1;
      if (isDemo) demoBackfilled += 1;
    }
  }

  console.log("=== MPIN backfill summary ===");
  console.log(`total scanned (users missing an MPIN) : ${users.length}`);
  console.log(`backfilled                            : ${backfilled}`);
  console.log(`known demo accounts backfilled        : ${demoBackfilled}`);
  console.log(`known demo mobiles                    : ${[...DEMO_MOBILES].join(", ")}`);
  console.log("=============================");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("MPIN backfill failed:", e);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});