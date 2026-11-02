import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "myambulance-dev-secret-change-in-prod";
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("FATAL: JWT_SECRET is required in production");
  process.exit(1);
}
if (!process.env.JWT_SECRET) console.warn("WARNING: using development JWT secret");

export const SESSION_TTL = "30d";
export const RECOVERY_TTL = "15m";
export const RESET_TTL = "10m";

export function signSession(user, { recovery = false } = {}) {
  return jwt.sign(
    {
      id: String(user._id || user.id),
      mobile: user.mobile,
      role: user.role,
      name: user.name,
      scope: "session",
      recovery: !!recovery
    },
    JWT_SECRET,
    { expiresIn: recovery ? RECOVERY_TTL : SESSION_TTL }
  );
}

export function signReset(user, nonce) {
  return jwt.sign({ id: String(user._id || user.id), scope: "reset", ...(nonce ? { rn: nonce } : {}) }, JWT_SECRET, { expiresIn: RESET_TTL });
}

export function verifyToken(token, expectedScope) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (expectedScope && payload.scope !== expectedScope) {
    const err = new Error("Invalid token scope");
    err.code = "SCOPE";
    throw err;
  }
  return payload;
}
