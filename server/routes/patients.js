import express from "express";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();
router.use(authMiddleware);

router.param("id", (req, res, next, val) => {
  if (!mongoose.Types.ObjectId.isValid(val)) {
    return res.status(404).json({ error: "Patient not found" });
  }
  next();
});

function validateEmergencyContacts(list) {
  if (list == null) return { contacts: undefined };
  if (!Array.isArray(list)) return { error: "emergencyContacts must be an array" };
  const contacts = [];
  for (const c of list.slice(0, 4)) {
    const name = String(c?.name ?? "").trim();
    const mobile = String(c?.mobile ?? "").trim();
    const relation = String(c?.relation ?? "").trim();
    if (!name) return { error: "Each emergency contact needs a name" };
    if (!/^\d{10}$/.test(mobile)) return { error: "Each emergency contact needs a 10-digit mobile" };
    contacts.push({ name, mobile, relation });
  }
  return { contacts };
}

router.get("/", async (req, res) => {
  const patients = await Patient.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
  res.json(patients);
});

router.get("/:id", async (req, res) => {
  const p = await Patient.findOne({ _id: req.params.id, ownerId: req.user.id });
  if (!p) return res.status(404).json({ error: "Patient not found" });
  res.json(p);
});

router.post("/", async (req, res) => {
  try {
    const { name, mobile, relation, age, gender, bloodGroup, diseases, allergies, personalDoctor, defaultEmergency, emergencyContacts } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Patient name is required" });
    if (!mobile || !/^[6-9]\d{9}$/.test(String(mobile).trim())) {
      return res.status(400).json({ error: "Valid 10-digit patient mobile is required" });
    }
    const contactCheck = validateEmergencyContacts(emergencyContacts);
    if (contactCheck.error) return res.status(400).json({ error: contactCheck.error });
    const patient = await Patient.create({
      ownerId: req.user.id,
      name: name.trim(),
      mobile: String(mobile).trim(),
      relation: relation || "Self",
      age: age || null,
      gender: gender || "",
      bloodGroup: bloodGroup || "",
      diseases: Array.isArray(diseases) ? diseases : String(diseases || "").split(",").map((s) => s.trim()).filter(Boolean),
      allergies: Array.isArray(allergies) ? allergies : String(allergies || "").split(",").map((s) => s.trim()).filter(Boolean),
      personalDoctor: personalDoctor || {},
      defaultEmergency: defaultEmergency || "General emergency",
      emergencyContacts: contactCheck.contacts || []
    });
    res.json(patient);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const update = { ...req.body };
    if ("emergencyContacts" in update) {
      const contactCheck = validateEmergencyContacts(req.body.emergencyContacts);
      if (contactCheck.error) return res.status(400).json({ error: contactCheck.error });
      update.emergencyContacts = contactCheck.contacts || [];
    }
    const p = await Patient.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user.id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!p) return res.status(404).json({ error: "Patient not found" });
    res.json(p);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  const p = await Patient.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
  if (!p) return res.status(404).json({ error: "Patient not found" });
  res.json({ ok: true });
});

router.post("/:id/tracker", async (req, res) => {
  try {
    const p = await Patient.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!p) return res.status(404).json({ error: "Patient not found" });
    const { note, bp, sugar, heartRate, weight } = req.body;
    p.healthTracker.unshift({ date: new Date(), note: note || "", bp: bp || "", sugar: sugar || "", heartRate: heartRate || "", weight: weight || "" });
    if (p.healthTracker.length > 100) p.healthTracker = p.healthTracker.slice(0, 100);
    await p.save();
    res.json(p);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
