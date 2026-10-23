import express from "express";
import User from "../models/User.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  // Intentionally available to any authenticated user: patients must pick a
  // family doctor from this list. `mobile` is required so the SOS overlay can
  // perform the "Call Dr." action. Sensitive/administrative fields such as
  // clinicAddress are excluded to minimize the PII surface.
  const doctors = await User.find({ role: "doctor" }).sort({ name: 1 }).limit(200);
  res.json(
    doctors.map((d) => ({
      id: d._id,
      name: d.name,
      mobile: d.mobile,
      specialization: d.doctorProfile?.specialization || "",
      degree: d.doctorProfile?.degree || ""
    }))
  );
});

export default router;
