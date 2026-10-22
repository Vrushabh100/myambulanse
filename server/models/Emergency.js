import mongoose from "mongoose";

const emergencySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      default: null
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null
    },
    emergencyType: { type: String, required: true },
    patientSnapshot: {
      name: { type: String, default: "" },
      mobile: { type: String, default: "" },
      age: { type: Number, default: null },
      gender: { type: String, default: "" },
      bloodGroup: { type: String, default: "" },
      diseases: [{ type: String }],
      allergies: [{ type: String }],
      personalDoctor: {
        name: { type: String, default: "" },
        degree: { type: String, default: "" },
        specialization: { type: String, default: "" },
        mobile: { type: String, default: "" }
      },
      emergencyContacts: [
        {
          name: { type: String, default: "" },
          mobile: { type: String, default: "" },
          relation: { type: String, default: "" },
          _id: false
        }
      ],
      healthTracker: [
        {
          date: { type: Date },
          note: { type: String, default: "" },
          bp: { type: String, default: "" },
          sugar: { type: String, default: "" },
          heartRate: { type: String, default: "" },
          weight: { type: String, default: "" },
          _id: false
        }
      ]
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null }
    },
    deviceState: {
      siren: { type: Boolean, default: true },
      beep: { type: Boolean, default: true },
      redLight: { type: Boolean, default: true },
      blueLight: { type: Boolean, default: true },
      navigation: { type: Boolean, default: true }
    },
    status: {
      type: String,
      enum: ["active", "acknowledged", "referred", "resolved", "cancelled"],
      default: "active",
      index: true
    },
    referral: {
      type: new mongoose.Schema(
        {
          toDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          toDoctorName: { type: String },
          byDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          byDoctorName: { type: String },
          note: { type: String },
          at: { type: Date }
        },
        { _id: false }
      ),
      default: null
    },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    doctorNote: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Emergency", emergencySchema);
