import app, { ensureDb } from "../server/index.js";

export default async function handler(req, res) {
  try {
    await ensureDb();
  } catch (e) {
    // let the app's db-down middleware answer with 503
    console.error("ensureDb failed:", e?.message || e);
  }
  return app(req, res);
}
