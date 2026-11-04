import express from "express";
import User from "../models/User.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  // Intentionally available to any authenticated user: patients must pick a
  // family doctor from this list. Only APPROVED doctors are listed; pending /
  // declined / suspended / banned accounts are hidden. `mobile` is required so
  // the SOS overlay can perform the "Call Dr." action; `clinicAddress` lets the
  // patient open the clinic location in Google Maps.
  const doctors = await User.find({
    role: "doctor",
    approvalStatus: { $nin: ["pending", "declined", "suspended", "banned"] }
  })
    .sort({ name: 1 })
    .limit(200);
  res.json(
    doctors.map((d) => ({
      id: d._id,
      name: d.name,
      mobile: d.mobile,
      specialization: d.doctorProfile?.specialization || "",
      degree: d.doctorProfile?.degree || "",
      clinicAddress: d.doctorProfile?.clinicAddress || ""
    }))
  );
});

export default router;