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
