const buckets = new Map();

export const isProd = process.env.NODE_ENV === "production";

export const RATE = {
  AUTH_IP: isProd ? 60 : 1000,
  AUTH_MOBILE: isProd ? 10 : 100,
  REGISTER_IP: isProd ? 20 : 1000,
  ADMIN_IP: isProd ? 10 : 100,
  DEFAULT_MOBILE: isProd ? 5 : 50,
  DEFAULT_WINDOW_MS: 15 * 60 * 1000,
  WINDOW_MS: 60 * 1000
};

const MAX_ENTRIES = 20000;

function sweep(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_ENTRIES) {
    for (const [key, bucket] of buckets) {
      if (buckets.size <= MAX_ENTRIES) break;
      buckets.delete(key);
    }
  }
}

const sweeper = setInterval(() => sweep(Date.now()), 60 * 1000);
if (sweeper && typeof sweeper.unref === "function") sweeper.unref();

export function checkLimit(key, limit, windowMs) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }
  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return {
    allowed: true,
    remaining,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  };
}

export function resetLimitsForTests() {
  buckets.clear();
}
