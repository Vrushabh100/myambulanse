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

app.get("/api/health", (req, res) => res.json({ ok: true, service: "myambulance" }));
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

async function start() {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      console.log("Connected to MongoDB:", uri.replace(/\/\/.*@/, "//***@"));
    } catch (e) {
      console.error("MongoDB Atlas connect failed, falling back to in-memory:", e.message);
      const mem = await MongoMemoryServer.create();
      await mongoose.connect(mem.getUri());
      console.log("Using in-memory MongoDB (Atlas unreachable)");
    }
  } else {
    const mem = await MongoMemoryServer.create();
    await mongoose.connect(mem.getUri());
    console.log("Using in-memory MongoDB (set MONGODB_URI to persist data)");
  }
  app.listen(PORT, () => console.log(`MyAmbulance API running on http://localhost:${PORT}`));
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});

