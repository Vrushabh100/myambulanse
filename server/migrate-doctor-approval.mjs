#!/usr/bin/env node
/**
 * MyAmbulance doctor-approval backfill (idempotent, safe to re-run).
 * Usage (from the server/ directory): node --env-file=.env migrate-doctor-approval.mjs
 *
 * Legacy doctors predate the approval lifecycle and have no approvalStatus.
 * Mark them "approved" so they keep working; only NEW registrations start pending.
 */
import dns from "dns";
import mongoose from "mongoose";
import User from "./models/User.js";

if (!process.env.VERCEL) {
  try { dns.setServers(["8.8.8.8", "1.1.1.1"]); console.log("DNS servers forced to 8.8.8.8, 1.1.1.1 (Node resolver fix)"); }
  catch (e) { console.warn("Could not force DNS servers:", e.message); }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error("MONGODB_URI is required"); process.exit(1); }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const res = await User.updateMany(
    { role: "doctor", approvalStatus: { $exists: false } },
    { $set: { approvalStatus: "approved", reviewedAt: new Date() } }
  );
  const total = await User.countDocuments({ role: "doctor" });
  const pending = await User.countDocuments({ role: "doctor", approvalStatus: "pending" });
  console.log("=== Doctor approval backfill summary ===");
  console.log(`backfilled to approved : ${res.modifiedCount}`);
  console.log(`total doctors          : ${total}`);
  console.log(`pending (new signups)  : ${pending}`);
  console.log("=======================================");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("Doctor approval backfill failed:", e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
