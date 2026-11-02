#!/usr/bin/env node
/**
 * MyAmbulance emergency targetDoctorIds backfill (idempotent, safe to re-run).
 *
 * Usage (from the server/ directory):
 *   node --env-file=.env migrate-emergency-targets.mjs
 *
 * Legacy emergencies were created before the Emergency model carried
 * `targetDoctorIds`, so a doctor's scoped feed never matched them. For legacy
 * backfill we target ONLY the patient's family doctor. If there is no family
 * doctor the row is explicitly set to [] so it never re-broadcasts old data to
 * every doctor (the exact bug being fixed).
 *
 * Idempotent: only rows where `targetDoctorIds` is entirely absent are scanned,
 * so rows already set (to a family doctor or to []) are not touched on re-run.
 */

import dns from "dns";
import mongoose from "mongoose";
import Emergency from "./models/Emergency.js";
import User from "./models/User.js";

// Node's default resolver reads 127.0.0.1 (dead stub on this machine) -> SRV
// queries for mongodb+srv:// get ECONNREFUSED. Force real DNS servers, unless
// we are running on Vercel (same behaviour as server/index.js and
// migrate-mpin.mjs).
if (!process.env.VERCEL) {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    console.log("DNS servers forced to 8.8.8.8, 1.1.1.1 (Node resolver fix)");
  } catch (e) {
    console.warn("Could not force DNS servers:", e.message);
  }
}

// Family doctor only: explicit doctorId, else resolve personalDoctor.mobile to
// a doctor User. No specialty or all-doctors fallback for legacy backfill.
async function resolveFamilyDoctorId(personalDoctor) {
  const pd = personalDoctor || {};
  let familyId = pd.doctorId || null;
  if (!familyId && pd.mobile) {
    const doc = await User.findOne({
      role: "doctor",
      mobile: String(pd.mobile).trim()
    }).select("_id");
    if (doc) familyId = doc._id;
  }
  return familyId;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  // Only rows where the field is entirely missing. Rows explicitly set to []
  // are NOT rewritten, keeping the migration idempotent.
  const emergencies = await Emergency.find({
    targetDoctorIds: { $exists: false }
  });

  let backfilledFamily = 0;
  let leftEmpty = 0;

  for (const e of emergencies) {
    const personalDoctor = (e.patientSnapshot && e.patientSnapshot.personalDoctor) || {};
    const familyId = await resolveFamilyDoctorId(personalDoctor);

    if (familyId) {
      await Emergency.updateOne({ _id: e._id }, { $set: { targetDoctorIds: [familyId] } });
      backfilledFamily += 1;
    } else {
      await Emergency.updateOne({ _id: e._id }, { $set: { targetDoctorIds: [] } });
      leftEmpty += 1;
    }
  }

  console.log("=== Emergency target backfill summary ===");
  console.log(`scanned (missing targetDoctorIds) : ${emergencies.length}`);
  console.log(`backfilledFamily                  : ${backfilledFamily}`);
  console.log(`leftEmpty                         : ${leftEmpty}`);
  console.log("=============================");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("Emergency target backfill failed:", e);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});