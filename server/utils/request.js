export function clientIp(req) {
  const forwarded = process.env.TRUST_PROXY === "1" ? req.headers["x-forwarded-for"] : "";
  let ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : "") || req.socket?.remoteAddress || "";
  ip = String(ip).trim();
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1" || ip === "127.0.0.1") ip = "127.0.0.1";
  return ip;
}

export function deviceLabel(req) {
  return String(req.headers["user-agent"] || "unknown").slice(0, 120);
}
