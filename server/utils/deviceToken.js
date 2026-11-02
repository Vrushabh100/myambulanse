import crypto from "crypto";
import DeviceToken from "../models/DeviceToken.js";
import { clientIp, deviceLabel } from "./request.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

export async function createDeviceToken(userId, req) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
  await DeviceToken.create({
    userId,
    tokenHash: hash(raw),
    deviceLabel: deviceLabel(req),
    createdIp: clientIp(req),
    lastUsedAt: new Date(),
    expiresAt
  });
  return raw;
}

export async function consumeDeviceToken(raw) {
  if (typeof raw !== "string" || raw.length < 20) return null;
  return DeviceToken.findOneAndDelete({
    tokenHash: hash(raw),
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  });
}

export async function revokeDeviceTokens(userId, raw) {
  if (raw && typeof raw === "string") {
    return DeviceToken.deleteMany({ userId, tokenHash: hash(raw) });
  }
  return DeviceToken.deleteMany({ userId });
}
