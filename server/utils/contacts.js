export function validateEmergencyContacts(list) {
  if (list === undefined || list === null) return { contacts: [] };
  if (!Array.isArray(list)) return { error: "emergencyContacts must be an array" };
  const contacts = [];
  for (const c of list.slice(0, 4)) {
    const name = String(c?.name ?? "").trim();
    const mobile = String(c?.mobile ?? "").trim();
    const relation = String(c?.relation ?? "").trim();
    if (!name && !mobile) continue;
    if (!name) return { error: "Each emergency contact needs a name" };
    if (!/^[6-9]\d{9}$/.test(mobile)) return { error: "Each emergency contact needs a 10-digit mobile" };
    contacts.push({ name, mobile, relation });
  }
  return { contacts };
}