import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["patient", "doctor"], default: "patient" },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "declined", "suspended", "banned"],
      default: "approved",
      index: true
    },
    approvalNote: { type: String, default: "" },
    suspendUntil: { type: Date, default: null },
    warnings: [
      {
        note: { type: String, default: "" },
        at: { type: Date, default: Date.now },
        _id: false
      }
    ],
    reviewedAt: { type: Date, default: null },
    address: { type: String, default: "" },
    doctorProfile: {
      degree: { type: String, default: "" },
      specialization: { type: String, default: "" },
      clinicAddress: { type: String, default: "" },
      clinicLat: { type: Number, default: null },
      clinicLng: { type: Number, default: null }
    },
    personalDoctor: {
      name: { type: String, default: "" },
      degree: { type: String, default: "" },
      specialization: { type: String, default: "" },
      mobile: { type: String, default: "" },
      clinicAddress: { type: String, default: "" },
      clinicLat: { type: Number, default: null },
      clinicLng: { type: Number, default: null },
      doctorId: { type: mongoose.Schema.Types.ObjectId, default: null }
    },
    emergencyContacts: [{ name: String, mobile: String, relation: String }],
    knownIps: [{ type: String }],
    lastLoginAt: { type: Date },
    mpinHash: { type: String, select: false },
    securityQuestion: { type: String, select: false },
    securityAnswerHash: { type: String, select: false },
    defaultMpinEnc: { type: String, select: false },
    mpinSetAt: { type: Date, default: null },
    securityQuestionUpdatedAt: { type: Date, default: null },
    failedMpinAttempts: { type: Number, default: 0 },
    failedAnswerAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    mpinBlocked: { type: Boolean, default: false },
    answerBlocked: { type: Boolean, default: false },
    needsSecuritySetup: { type: Boolean, default: false },
    resetNonce: { type: String, default: null, select: false }
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.mpinHash;
    delete ret.securityAnswerHash;
    delete ret.defaultMpinEnc;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model("User", userSchema);
