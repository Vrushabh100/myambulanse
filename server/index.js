import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dns from "dns";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patients.js";
import vehicleRoutes from "./routes/vehicles.js";
import emergencyRoutes from "./routes/emergencies.js";
import doctorRoutes from "./routes/doctors.js";

// Node's default resolver reads 127.0.0.1 (dead stub on this machine) -> SRV queries
// for mongodb+srv:// get ECONNREFUSED. Force real DNS servers for this process.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  console.log("DNS servers forced to 8.8.8.8, 1.1.1.1 (Node resolver fix)");
} catch (e) {
  console.warn("Could not force DNS servers:", e.message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// An async route that throws (e.g. mongoose CastError) must never kill the API process.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (kept server alive):", err?.stack || err);
});

// Never buffer queries while disconnected: throw immediately instead of hanging ~10s.
mongoose.set("bufferCommands", false);

// dbState: "connecting" | "connected" (Atlas) | "memory" (in-memory fallback) | "down"
let dbState = "connecting";
let memServer = null;
let memPromise = null;
let dbBusy = false;
let retryTimer = null;

function timeout(ms, label) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(label + " timed out after " + ms + "ms")), ms);
    if (timer.unref) timer.unref();
  });
}

// Cache the in-flight create() so a timed-out attempt is reused, not duplicated.
function getMemoryServer() {
  if (memServer) return Promise.resolve(memServer);
  if (!memPromise) {
    memPromise = MongoMemoryServer.create().then((mem) => {
      memServer = mem;
      return mem;
    });
    memPromise.catch(() => {
      memPromise = null; // hard failure -> allow a fresh attempt on retry
    });
  }
  return memPromise;
}

async function connectMemory() {
  const mem = await Promise.race([
    getMemoryServer(),
    timeout(25000, "In-memory MongoDB startup (binary download)")
  ]);
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mem.getUri(), { serverSelectionTimeoutMS: 5000 });
  }
  dbState = "memory";
  console.log("Using in-memory MongoDB (set MONGODB_URI to persist data)");
}

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
    if (uri) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        dbState = "connected";
        console.log("Connected to MongoDB Atlas:", uri.replace(/\/\/.*@/, "//***@"));
        return;
      } catch (e) {
        console.error("MongoDB Atlas connect failed:", e.message);
      }
    }
    try {
      await connectMemory();
    } catch (e) {
      console.error("In-memory MongoDB fallback failed:", e.message);
    }
    if (dbState !== "connected" && dbState !== "memory") {
      dbState = "down";
      console.error("Database unavailable - API returns 503 for DB routes, retrying in 15s");
      scheduleRetry();
    }
  } finally {
    dbBusy = false;
  }
}

app.get("/api/health", (req, res) =>
  res.json({ ok: true, service: "myambulance", db: dbState, uptime: process.uptime() })
);

// Fast 503 when the database is down: never let a DB route hang or buffer.
app.use("/api", (req, res, next) => {
  if (dbState === "connected" || dbState === "memory") return next();
  if (req.path === "/health") return next();
  res.status(503).json({ error: "Database unavailable" });
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/doctors", doctorRoutes);

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

// Listen immediately: the HTTP server must never wait on the database.
app.listen(PORT, () => {
  console.log("MyAmbulance API running on http://localhost:" + PORT);
  connectDb().catch((e) => {
    console.error("DB connect loop error:", (e && e.message) || e);
    dbState = "down";
    scheduleRetry();
  });
});
