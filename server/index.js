import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dns from "dns";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patients.js";
import vehicleRoutes from "./routes/vehicles.js";
import emergencyRoutes from "./routes/emergencies.js";
import doctorRoutes from "./routes/doctors.js";

// Node's default resolver reads 127.0.0.1 (dead stub on this machine) -> SRV queries
// for mongodb+srv:// get ECONNREFUSED. Force real DNS servers for this process.
if (!process.env.VERCEL || process.env.FORCE_DNS === "1") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    console.log("DNS servers forced to 8.8.8.8, 1.1.1.1 (Node resolver fix)");
  } catch (e) {
    console.warn("Could not force DNS servers:", e.message);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5050")
  .split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);            // same-origin / server-to-server / curl
    return ALLOWED_ORIGINS.includes(origin) ? cb(null, true) : cb(null, false);
  }
}));
app.use(express.json({ limit: "2mb" }));

// An async route that throws (e.g. mongoose CastError) must never kill the API process.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (kept server alive):", err?.stack || err);
});

// Never buffer queries while disconnected: throw immediately instead of hanging ~10s.
mongoose.set("bufferCommands", false);

// dbState: "connecting" | "connected" (Atlas) | "down"
let dbState = "connecting";
let dbBusy = false;
let retryTimer = null;

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectDb();
  }, 15000);
  if (retryTimer.unref) retryTimer.unref();
}

async function connectDb() {
  if (dbBusy) return;
  dbBusy = true;
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      dbState = "down";
      console.error("MONGODB_URI is required — set it to your MongoDB Atlas connection string.");
      scheduleRetry();
      return;
    }
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      dbState = "connected";
      console.log("Connected to MongoDB Atlas:", uri.replace(/\/\/.*@/, "//***@"));
      return;
    } catch (e) {
      dbState = "down";
      console.error("MongoDB Atlas connect failed:", e.message, "- check Atlas Network Access allows this IP");
      scheduleRetry();
      return;
    }
  } finally {
    dbBusy = false;
  }
}

// Serverless platforms (Vercel) never call start(), so the handler bootstraps the
// connection itself. Cache the promise on globalThis so warm invocations reuse it.
export async function ensureDb() {
  // If already connected to Atlas, return immediately.
  if (dbState === "connected") return;
  // Otherwise reuse the SAME connect logic as start(): dedupe concurrent cold
  // starts on one in-flight promise; clear it on hard failure so a later
  // invocation can try again.
  if (!globalThis.__maDbPromise) {
    globalThis.__maDbPromise = connectDb().catch((e) => {
      globalThis.__maDbPromise = null;
      throw e;
    });
  }
  return globalThis.__maDbPromise;
}

app.get("/api/health", (req, res) =>
  res.json({ ok: true, service: "myambulance", db: dbState, uptime: process.uptime() })
);

// Fast 503 when the database is down: never let a DB route hang or buffer.
app.use("/api", (req, res, next) => {
  if (dbState === "connected") return next();
  if (req.path === "/health") return next();
  res.status(503).json({ error: "Database unavailable" });
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/doctors", doctorRoutes);

// Unknown /api paths must answer JSON 404 — never an empty/HTML body.
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Serve the built client (single-origin production: server + client in one service).
const clientDist = path.resolve(__dirname, "..", "client", "dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET that wants HTML gets index.html.
  app.get(/^(?!\/api(\/|$)).*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!req.accepts("html")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log("Serving client build from", clientDist);
} else {
  console.log("No client build found at", clientDist, "- API only");
}

const PORT = process.env.PORT || 5050;

// Connect + listen for local / long-running hosts. Listen immediately, then
// bootstrap the DB via ensureDb() (the same logic the serverless handler uses):
// the HTTP server must never wait on the database.
async function start() {
  app.listen(PORT, () => {
    console.log("MyAmbulance API running on http://localhost:" + PORT);
    ensureDb().catch((e) => {
      console.error("DB connect loop error:", (e && e.message) || e);
      dbState = "down";
      scheduleRetry();
    });
  });
}

export default app;

// Local / long-running hosts only: Vercel provides its own HTTP handler.
if (!process.env.VERCEL) {
  start().catch((e) => { console.error("Failed to start server:", e); process.exit(1); });
}