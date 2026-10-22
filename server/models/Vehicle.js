import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    label: { type: String, default: "" },
    active: { type: Boolean, default: false }
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    registrationNo: { type: String, required: true, trim: true, uppercase: true },
    ownerName: { type: String, required: true, trim: true },
    vehicleModel: { type: String, default: "" },
    color: { type: String, default: "" },
    devices: {
      type: [deviceSchema],
      validate: (v) => v.length === 2,
      required: true
    },
    assignedPatientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      default: null
    },
    lastLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null }
    },
    status: {
      type: String,
      enum: ["idle", "emergency", "offline"],
      default: "idle"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Vehicle", vehicleSchema);
