export const GATE_HASH = "c1b6688bab7b5dcf0fe0993567abdf9cde312ce6083a21543426d22691f78240";
const UNLOCK_KEY = "ma_admin_unlocked";

export function isAdminUnlocked() {
  try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
}
export function unlockAdmin() {
  try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* ignore */ }
}
export function lockAdmin() {
  try { sessionStorage.removeItem(UNLOCK_KEY); } catch { /* ignore */ }
}
export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}