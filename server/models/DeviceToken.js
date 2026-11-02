import mongoose from "mongoose";

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    deviceLabel: { type: String },
    createdIp: { type: String },
    lastUsedAt: { type: Date },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
    revokedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("DeviceToken", deviceTokenSchema);
