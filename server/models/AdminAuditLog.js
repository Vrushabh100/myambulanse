import mongoose from "mongoose";

const adminAuditLogSchema = new mongoose.Schema(
  {
    mobile: { type: String, index: true },
    adminRef: { type: String },
    ip: { type: String },
    at: { type: Date, index: true, default: Date.now },
    result: { type: String, enum: ["found", "not_found", "denied"] }
  },
  { timestamps: true }
);

export default mongoose.model("AdminAuditLog", adminAuditLogSchema);
