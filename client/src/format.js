// Adds a "Dr " prefix only when the name does not already start with Dr / Dr. / Doctor.
export function doctorLabel(name, { withDot = false } = {}) {
  const n = String(name || "").trim();
  if (!n) return "";
  if (/^(dr\.?|doctor)\b/i.test(n)) return n;
  return (withDot ? "Dr. " : "Dr ") + n;
}