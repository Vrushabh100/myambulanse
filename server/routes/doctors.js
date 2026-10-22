import express from "express";
import User from "../models/User.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  if (!req.user || req.user.role !== "doctor") {
    return res.status(403).json({ error: "Doctor access only" });
  }
  const doctors = await User.find({ role: "doctor" }).sort({ name: 1 });
  res.json(
    doctors.map((d) => ({
      id: d._id,
      name: d.name,
      mobile: d.mobile,
      specialization: d.doctorProfile?.specialization || ""
    }))
  );
});

export default router;
