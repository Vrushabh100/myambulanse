import express from "express";
import mongoose from "mongoose";
import Emergency from "../models/Emergency.js";
import Patient from "../models/Patient.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();
router.use(authMiddleware);

const CLOSED_STATUSES = ["resolved", "cancelled"];
const REFERABLE_STATUSES = ["active", "acknowledged", "referred"];

const EMERGENCY_SPECIALTY = {
  "Heart attack / Chest pain": ["Cardiology"],
  "Breathing difficulty": ["Pulmonology", "Cardiology", "General"],
  "Stroke symptoms": ["Neurology"],
  "Severe bleeding / Accident": ["Trauma Surgery", "Orthopedics", "General"],
  "Snake bite / Poisoning": ["General", "Trauma Surgery"],
  "Fracture / Serious injury": ["Orthopedics", "Trauma Surgery"],
  "Pregnancy complication": ["Gynecology", "Obstetrics", "General"],
  "High fever + unconscious": ["General", "Medicine"],
  "General emergency": []
};

async function resolveTargetDoctorIds(personalDoctor, emergencyType) {
  // 1) explicit family doctor
  const pd = personalDoctor || {};
  let familyId = pd.doctorId || null;
  if (!familyId && pd.mobile) {
    const doc = await User.findOne({ role: "doctor", mobile: String(pd.mobile).trim() }).select("_id");
    if (doc) familyId = doc._id;
  }
  if (familyId) return [familyId];

  // 2) route by emergency type -> specialization
  const specs = EMERGENCY_SPECIALTY[emergencyType] || [];
  if (specs.length) {
    const matches = await User.find({ role: "doctor", "doctorProfile.specialization": { $in: specs }, approvalStatus: { $nin: ["pending", "declined", "suspended", "banned"] } }).select("_id");
    if (matches.length) return matches.map((d) => d._id);
  }

  // 3) fallback: every doctor
  const all = await User.find({ role: "doctor", approvalStatus: { $nin: ["pending", "declined", "suspended", "banned"] } }).select("_id");
  return all.map((d) => d._id);
}

router.param("id", (req, res, next, val) => {
  if (!mongoose.Types.ObjectId.isValid(val)) {
    return res.status(404).json({ error: "Emergency not found" });
  }
  next();
});

function requireDoctor(req, res, next) {
  if (!req.user || req.user.role !== "doctor") {
    return res.status(403).json({ error: "Doctor access only" });
  }
  next();
}

// A doctor may act on an emergency only if it matches their visibility rules.
function doctorCanSee(e, user) {
  if (String(e.userId) === String(user.id)) return true;
  if (user.role !== "doctor") return false;
  const ref = e.referral || {};
  const targets = (e.targetDoctorIds || []).map(String);
  return (
    targets.includes(String(user.id)) ||
    (ref.toDoctorId && String(ref.toDoctorId) === String(user.id)) ||
    (ref.byDoctorId && String(ref.byDoctorId) === String(user.id))
  );
}

// Load an emergency the caller is allowed to act on, else null (callers respond 404).
async function loadActableEmergency(req) {
  const e = await Emergency.findById(req.params.id);
  if (!e) return null;
  return doctorCanSee(e, req.user) ? e : null;
}

// Reusable SOS visibility filter for doctor-role listings. A doctor sees an
// emergency only if they are explicitly targeted (targetDoctorIds), or they are
// on the referral (referring or receiving) for it.
function doctorVisibilityFilter(user) {
  return {
    $or: [
      { targetDoctorIds: user.id },
      { "referral.toDoctorId": user.id },
      { "referral.byDoctorId": user.id }
    ]
  };
}

router.post("/sos", async (req, res) => {
  try {
    const { patientId, vehicleId, emergencyType, location } = req.body;
    let patient = null;
    if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
      patient = await Patient.findOne({ _id: patientId, ownerId: req.user.id });
    }
    let vehicle = null;
    if (vehicleId && mongoose.Types.ObjectId.isValid(vehicleId)) {
      vehicle = await Vehicle.findOne({ _id: vehicleId, ownerId: req.user.id });
    }
    let meUser = req.user;
    if (!patient) {
      meUser =
        (await User.findById(req.user.id).select("name mobile emergencyContacts personalDoctor")) || req.user;
    }
    const snapshot = patient
      ? {
          name: patient.name,
          mobile: patient.mobile,
          age: patient.age,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          diseases: patient.diseases,
          allergies: patient.allergies,
          personalDoctor: patient.personalDoctor,
          emergencyContacts: (patient.emergencyContacts || []).map((c) => ({
            name: c.name || "",
            mobile: c.mobile || "",
            relation: c.relation || ""
          })),
          healthTracker: (patient.healthTracker || []).slice(0, 10).map((r) => ({
            date: r.date,
            note: r.note,
            bp: r.bp,
            sugar: r.sugar,
            heartRate: r.heartRate,
            weight: r.weight
          }))
        }
      : {
          name: meUser.name || req.user.name,
          mobile: meUser.mobile || req.user.mobile,
          diseases: [],
          allergies: [],
          personalDoctor: meUser.personalDoctor || {},
          emergencyContacts: (meUser.emergencyContacts || []).map((c) => ({
            name: c.name,
            mobile: c.mobile,
            relation: c.relation || "Family"
          })),
          healthTracker: []
        };

    const targetDoctorIds = await resolveTargetDoctorIds(
      patient ? patient.personalDoctor : (meUser.personalDoctor || {}),
      emergencyType || patient?.defaultEmergency || "General emergency"
    );

    const emergency = await Emergency.create({
      userId: req.user.id,
      patientId: patient ? patient._id : null,
      vehicleId: vehicle ? vehicle._id : null,
      targetDoctorIds,
      emergencyType: emergencyType || patient?.defaultEmergency || "General emergency",
      patientSnapshot: snapshot,
      location: {
        lat: location && location.lat != null ? Number(location.lat) : null,
        lng: location && location.lng != null ? Number(location.lng) : null,
        accuracy: location && location.accuracy != null ? Number(location.accuracy) : null
      },
      deviceState: { siren: true, beep: true, redLight: true, blueLight: true, navigation: true },
      status: "active"
    });

    if (vehicle) {
      vehicle.status = "emergency";
      vehicle.devices.forEach((d) => (d.active = true));
      if (location && location.lat != null) {
        vehicle.lastLocation = { lat: Number(location.lat), lng: Number(location.lng), updatedAt: new Date() };
      }
      await vehicle.save();
    }

    res.json(emergency);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Patient updates their live location while the SOS is active.
router.post("/:id/location", async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body || {};
    const e = await Emergency.findById(req.params.id);
    if (!e) return res.status(404).json({ error: "Emergency not found" });
    if (String(e.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not your emergency" });
    }
    if (CLOSED_STATUSES.includes(e.status)) {
      return res.status(409).json({ error: "Emergency is closed" });
    }
    if (lat != null && lng != null) {
      const la = Number(lat);
      const ln = Number(lng);
      if (Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180) {
        e.location = {
          lat: la,
          lng: ln,
          accuracy: accuracy != null && Number.isFinite(Number(accuracy)) ? Number(accuracy) : (e.location && e.location.accuracy) || null
        };
        await e.save();
      }
    }
    res.json({ ok: true, location: e.location });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  const filter = req.user.role === "doctor" ? doctorVisibilityFilter(req.user) : { userId: req.user.id };
  const emergencies = await Emergency.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json(emergencies);
});

router.get("/active", async (req, res) => {
  const filter = { status: { $in: ["active", "acknowledged", "referred"] } };
  if (req.user.role !== "doctor") {
    filter.userId = req.user.id;
  } else {
    Object.assign(filter, doctorVisibilityFilter(req.user));
  }
  const emergencies = await Emergency.find(filter).sort({ createdAt: -1 });
  res.json(emergencies);
});

router.get("/stats", async (req, res) => {
  try {
    const filter = req.user.role === "doctor" ? doctorVisibilityFilter(req.user) : { userId: req.user.id };
    const [total, active, resolved] = await Promise.all([
      Emergency.countDocuments(filter),
      Emergency.countDocuments({ ...filter, status: { $in: ["active", "acknowledged", "referred"] } }),
      Emergency.countDocuments({ ...filter, status: "resolved" })
    ]);
    res.json({ total, active, resolved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/acknowledge", async (req, res) => {
  const e = await loadActableEmergency(req);
  if (!e) return res.status(404).json({ error: "Emergency not found" });
  if (CLOSED_STATUSES.includes(e.status)) {
    return res.status(400).json({ error: "Emergency already closed" });
  }
  e.status = "acknowledged";
  e.acknowledgedAt = new Date();
  await e.save();
  res.json(e);
});

router.post("/:id/approve", requireDoctor, async (req, res) => {
  const e = await loadActableEmergency(req);
  if (!e) return res.status(404).json({ error: "Emergency not found" });
  if (CLOSED_STATUSES.includes(e.status)) {
    return res.status(400).json({ error: "Emergency already closed" });
  }
  e.status = "acknowledged";
  e.acknowledgedAt = new Date();
  await e.save();
  res.json(e);
});

router.post("/:id/refer", requireDoctor, async (req, res) => {
  try {
    const { toDoctorId, note } = req.body || {};
    if (!toDoctorId || !mongoose.Types.ObjectId.isValid(toDoctorId)) {
      return res.status(400).json({ error: "toDoctorId is required" });
    }
    if (String(toDoctorId) === String(req.user.id)) {
      return res.status(400).json({ error: "Cannot refer an emergency to yourself" });
    }
    const target = await User.findOne({ _id: toDoctorId, role: "doctor" });
    if (!target) {
      return res.status(400).json({ error: "Target user is not a doctor" });
    }
    const e = await loadActableEmergency(req);
    if (!e) return res.status(404).json({ error: "Emergency not found" });
    if (CLOSED_STATUSES.includes(e.status)) {
      return res.status(400).json({ error: "Emergency already closed" });
    }
    if (!REFERABLE_STATUSES.includes(e.status)) {
      return res.status(400).json({ error: `Cannot refer an emergency with status "${e.status}"` });
    }
    e.status = "referred";
    e.referral = {
      toDoctorId: target._id,
      toDoctorName: target.name,
      byDoctorId: new mongoose.Types.ObjectId(req.user.id),
      byDoctorName: req.user.name || "",
      note: note ? String(note) : "",
      at: new Date()
    };
    await e.save();
    res.json(e);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/resolve", async (req, res) => {
  try {
    const { doctorNote } = req.body;
    const update = { status: "resolved", resolvedAt: new Date() };
    if (doctorNote) update.doctorNote = doctorNote;
    const allowed = await loadActableEmergency(req);
    if (!allowed) return res.status(404).json({ error: "Emergency not found" });
    // Atomic guard: only an open emergency can be closed, so a concurrent
    // resolve/cancel by a colleague loses the race with 400 instead of 200.
    const e = await Emergency.findOneAndUpdate(
      { _id: req.params.id, status: { $nin: CLOSED_STATUSES } },
      { $set: update },
      { new: true }
    );
    if (!e) {
      const exists = await Emergency.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: "Emergency not found" });
      return res.status(400).json({ error: "Emergency already closed" });
    }
    if (e.vehicleId) {
      await Vehicle.findByIdAndUpdate(e.vehicleId, {
        status: "idle",
        $set: { "devices.$[].active": false }
      });
    }
    res.json(e);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const allowed = await loadActableEmergency(req);
    if (!allowed) return res.status(404).json({ error: "Emergency not found" });
    const e = await Emergency.findOneAndUpdate(
      { _id: req.params.id, status: { $nin: CLOSED_STATUSES } },
      { $set: { status: "cancelled" } },
      { new: true }
    );
    if (!e) {
      const exists = await Emergency.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: "Emergency not found" });
      return res.status(400).json({ error: "Emergency already closed" });
    }
    if (e.vehicleId) {
      await Vehicle.findByIdAndUpdate(e.vehicleId, {
        status: "idle",
        $set: { "devices.$[].active": false }
      });
    }
    res.json(e);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;