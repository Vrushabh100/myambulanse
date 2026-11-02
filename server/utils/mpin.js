import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

export const CUSTOMER_CARE = "+91 8007470450";

export const SECURITY_QUESTIONS = [
  "What was the model of your first phone?",
  "What was the nickname only your family used for you?",
  "What is the name of the street you lived on as a child?",
  "What was the name of your first childhood pet?",
  "What make and model was your first car or bike?",
  "What is the first and last name of a childhood friend your family still remembers?",
  "What was the name of your first employer or workplace?",
  "What is the title of a movie you could rewatch endlessly?",
  "What is the exact name of the hospital or clinic where you were born?",
  "What was your favourite dish cooked by a grandparent? (dish name)"
];

export const MPIN_LENGTH = 6;
export const WEAK_MPIN_MESSAGE =
  "MPIN must be 6 digits and must not be 000000, 111111, 123456, 654321, or a repeated/sequential number";

export const LOCK_BREAK_ATTEMPTS = 5;
export const LOCK_MAX_ATTEMPTS = 15;
export const LOCK_SECONDS = Math.max(1, Number(process.env.MPIN_LOCK_SECONDS) || 60);

const EXPLICIT_WEAK = new Set(["000000", "111111", "123456", "654321"]);
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function isValidMpinFormat(v) {
  return typeof v === "string" && /^\d{6}$/.test(v.trim());
}

function isAllSame(s) {
  return s.split("").every((c) => c === s[0]);
}

function isSequential(s) {
  let asc = true;
  let desc = true;
  for (let i = 1; i < s.length; i++) {
    const prev = s.charCodeAt(i - 1);
    const cur = s.charCodeAt(i);
    if (cur !== prev + 1) asc = false;
    if (cur !== prev - 1) desc = false;
  }
  return asc || desc;
}

function isRepeatedPattern(s, size) {
  const pattern = s.slice(0, size);
  if (pattern.length !== size) return false;
  for (let i = size; i < s.length; i += size) {
    if (s.slice(i, i + size) !== pattern) return false;
  }
  return true;
}

function isPairedPattern(s) {
  for (let i = 0; i < s.length; i += 2) {
    if (s[i] !== s[i + 1]) return false;
  }
  return true;
}

export function isStrongMpin(v) {
  if (!isValidMpinFormat(v)) return false;
  const s = v.trim();
  if (EXPLICIT_WEAK.has(s)) return false;
  if (isAllSame(s)) return false;
  if (isSequential(s)) return false;
  if (isRepeatedPattern(s, 2)) return false;
  if (isRepeatedPattern(s, 3)) return false;
  if (isPairedPattern(s)) return false;
  return true;
}

export function generateDefaultMpin() {
  for (let i = 0; i < 1000; i++) {
    const candidate = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    if (isStrongMpin(candidate)) return candidate;
  }
  throw new Error("Could not generate a strong default MPIN");
}

export function normalizeAnswer(v) {
  if (typeof v !== "string" || v === null) return "";
  return String(v)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export async function hashSecret(plain) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(String(plain), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifySecret(plain, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N <= 0 || r <= 0 || p <= 0) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], "hex");
    expected = Buffer.from(parts[5], "hex");
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  let actual;
  try {
    actual = await scrypt(String(plain), salt, expected.length, { N, r, p, maxmem: SCRYPT_MAXMEM });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export async function burnScrypt() {
  const salt = crypto.randomBytes(16);
  try {
    await scrypt("__burn__", salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM
    });
  } catch {
    // best-effort timing equalisation
  }
}

export function safeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function applyLockPolicy(count, now = new Date()) {
  const blocked = count >= LOCK_MAX_ATTEMPTS;
  const lockUntil =
    !blocked && count > 0 && count % LOCK_BREAK_ATTEMPTS === 0
      ? new Date(now.getTime() + LOCK_SECONDS * 1000)
      : null;
  return { blocked, lockUntil };
}

function decodeKey(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  let buf = null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    buf = Buffer.from(value, "hex");
  } else {
    try {
      buf = Buffer.from(value, "base64");
    } catch {
      buf = null;
    }
  }
  if (!buf || buf.length !== 32) return null;
  return buf;
}

export function isEncryptionConfigured() {
  return decodeKey(process.env.DEFAULT_MPIN_ENC_KEY) !== null;
}

function cryptoUnavailable() {
  const err = new Error("Default MPIN encryption key is not configured");
  err.code = "MPIN_CRYPTO_UNAVAILABLE";
  return err;
}

export function encryptDefaultMpin(plain) {
  const key = decodeKey(process.env.DEFAULT_MPIN_ENC_KEY);
  if (!key) throw cryptoUnavailable();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + enc.toString("hex");
}

export function decryptDefaultMpin(enc) {
  if (typeof enc !== "string") throw new Error("Invalid encrypted MPIN");
  const parts = enc.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted MPIN");
  const key = decodeKey(process.env.DEFAULT_MPIN_ENC_KEY);
  if (!key) throw cryptoUnavailable();
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const data = Buffer.from(parts[2], "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
