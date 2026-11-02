export const MOBILE_RE = /^[6-9]\d{9}$/;
export const WEAK_MPIN_MESSAGE =
  "MPIN must be 6 digits and must not be 000000, 111111, 123456, 654321, or a repeated/sequential number";

export function weakMpin(s) {
  if (!/^\d{6}$/.test(s)) return true;
  if (["000000", "111111", "123456", "654321"].includes(s)) return true;
  if (s.split("").every((c) => c === s[0])) return true;
  let asc = true;
  let desc = true;
  for (let i = 1; i < 6; i++) {
    const a = s.charCodeAt(i - 1);
    const b = s.charCodeAt(i);
    if (b !== a + 1) asc = false;
    if (b !== a - 1) desc = false;
  }
  if (asc || desc) return true;
  const pat = (n) => {
    const p = s.slice(0, n);
    for (let i = n; i < 6; i += n) if (s.slice(i, i + n) !== p) return false;
    return true;
  };
  if (pat(2) || pat(3)) return true;
  if (s[0] === s[1] && s[2] === s[3] && s[4] === s[5]) return true;
  return false;
}