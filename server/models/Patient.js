import mongoose from "mongoose";

const healthRecordSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    bp: { type: String, default: "" },
    sugar: { type: String, default: "" },
    heartRate: { type: String, default: "" },
    weight: { type: String, default: "" }
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    relation: { type: String, default: "Self" },
    age: { type: Number, default: null },
    gender: { type: String, default: "" },
    bloodGroup: { type: String, default: "" },
    diseases: [{ type: String }],
    allergies: [{ type: String }],
    personalDoctor: {
      name: { type: String, default: "" },
      degree: { type: String, default: "" },
      specialization: { type: String, default: "" },
      mobile: { type: String, default: "" },
      doctorId: { type: mongoose.Schema.Types.ObjectId, default: null }
    },
    defaultEmergency: { type: String, default: "General emergency" },
    emergencyContacts: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, default: "" },
            mobile: { type: String, default: "" },
            relation: { type: String, default: "" }
          },
          { _id: false }
        )
      ],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.length <= 4,
        message: "A patient can have at most 4 emergency contacts"
      }
    },
    healthTracker: [healthRecordSchema]
  },
  { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
