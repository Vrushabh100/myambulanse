import express from "express";
import mongoose from "mongoose";
import Vehicle from "../models/Vehicle.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();
router.use(authMiddleware);

router.param("id", (req, res, next, val) => {
  if (!mongoose.Types.ObjectId.isValid(val)) {
    return res.status(404).json({ error: "Vehicle not found" });
  }
  next();
});

router.get("/", async (req, res) => {
  const vehicles = await Vehicle.find({ ownerId: req.user.id })
    .populate("assignedPatientId", "name mobile diseases")
    .sort({ createdAt: -1 });
  res.json(vehicles);
});

router.get("/:id", async (req, res) => {
  const v = await Vehicle.findOne({ _id: req.params.id, ownerId: req.user.id }).populate(
    "assignedPatientId",
    "name mobile diseases"
  );
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  res.json(v);
});

router.post("/", async (req, res) => {
  try {
    const { registrationNo, ownerName, vehicleModel, color, devices } = req.body;
    if (!registrationNo || !registrationNo.trim()) {
      return res.status(400).json({ error: "Car registration number is required" });
    }
    if (!ownerName || !ownerName.trim()) {
      return res.status(400).json({ error: "Car owner name is required" });
    }
    if (!Array.isArray(devices) || devices.length !== 2 || devices.some((d) => !d || !String(d.deviceId || "").trim())) {
      return res.status(400).json({ error: "Exactly 2 device IDs are required (the emergency siren device kit)" });
    }
    const normalized = devices.map((d, i) => ({
      deviceId: String(d.deviceId).trim().toUpperCase(),
      label: d.label || `Device ${i + 1}`,
      active: false
    }));
    const dup = await Vehicle.findOne({
      "devices.deviceId": { $in: normalized.map((d) => d.deviceId) }
    });
    if (dup) {
      return res.status(409).json({ error: "One of these device IDs is already registered to a car" });
    }
    const dupReg = await Vehicle.findOne({ registrationNo: registrationNo.trim().toUpperCase() });
    if (dupReg) {
      return res.status(409).json({ error: "This car registration number is already registered" });
    }
    const vehicle = await Vehicle.create({
      ownerId: req.user.id,
      registrationNo: registrationNo.trim().toUpperCase(),
      ownerName: ownerName.trim(),
      vehicleModel: vehicleModel || "",
      color: color || "",
      devices: normalized
    });
    res.json(vehicle);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: "This car registration number is already registered" });
    }
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const v = await Vehicle.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!v) return res.status(404).json({ error: "Vehicle not found" });
    const { registrationNo, ownerName, vehicleModel, color, assignedPatientId } = req.body;
    if (registrationNo) {
      const reg = registrationNo.trim().toUpperCase();
      const dupReg = await Vehicle.findOne({ registrationNo: reg, _id: { $ne: v._id } });
      if (dupReg) {
        return res.status(409).json({ error: "This car registration number is already registered" });
      }
      v.registrationNo = reg;
    }
    if (ownerName) v.ownerName = ownerName.trim();
    if (vehicleModel !== undefined) v.vehicleModel = vehicleModel;
    if (color !== undefined) v.color = color;
    if (assignedPatientId !== undefined) v.assignedPatientId = assignedPatientId || null;
    await v.save();
    res.json(v);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  const v = await Vehicle.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  res.json({ ok: true });
});

router.post("/:id/location", async (req, res) => {
  const { lat, lng } = req.body;
  const v = await Vehicle.findOne({ _id: req.params.id, ownerId: req.user.id });
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  v.lastLocation = { lat: Number(lat), lng: Number(lng), updatedAt: new Date() };
  await v.save();
  res.json(v);
});

export default router;
