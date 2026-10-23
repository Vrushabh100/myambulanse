import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["patient", "doctor"], default: "patient" },
    address: { type: String, default: "" },
    doctorProfile: {
      degree: { type: String, default: "" },
      specialization: { type: String, default: "" },
      clinicAddress: { type: String, default: "" }
    },
    emergencyContacts: [{ name: String, mobile: String, relation: String }],
    knownIps: [{ type: String }],
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
