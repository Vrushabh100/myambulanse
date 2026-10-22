# UI Rebuild Spec — Tangerine-style Petal Wheel (MyAmbulance client)

## User feedback (exact intent)
Patient dashboard radial hub looks "AI-generated". Rebuild it to match **tangerineformac.com's radial
menu** (production CSS fetched). SOS button thoda small karo. Everything must look hand-crafted/professional.

## Hard constraints
- Touch ONLY `C:\Users\vrush\Desktop\myambulance\client` (never server/, never infotray).
- Do NOT kill processes: :5173 (Vite hot-reload) and :5050 (API) stay up.
- End with `npm run build` exit 0 in client/.
- KEEP ALL FUNCTIONALITY: SOS flow (vibrate [150,80,150] → geolocation → POST /emergencies/sos → short
  siren → .emg-overlay with tel: call buttons + device panel + cancel + floating red bar), patient/vehicle
  chips + defaultEmergency auto-sync, SOS history + stats, doctor Approve/Refer/Cancel + refer panel +
  ringtone + 5s polling, tel: links, restore active SOS on mount, history-row click restore.
- Brand tokens stay (Sampark): --yellow #FFED00, --ink #17160F, --paper #FBFAF5, --sand #F1EFE6,
  --red #E5322D, Fredoka (headings) + Nunito (body). DON'T switch to Tangerine's orange/DM Sans — only
  copy their MECHANICS/finish.

## Tangerine reference mechanics (from their real CSS)
- Wheel ~272px, `transform: translate(-50%,-50%)`, entrance `animation: bloom .2s cubic-bezier(.18,.82,.24,1)`
  where bloom = from { opacity:0; scale(.45) } to { opacity:1; scale(1) }.
- `.fan-glass`: circle inset ~10px, border-radius 50%, `backdrop-filter: blur(16px) saturate(1.45)`,
  translucent fill, radial-gradient MASK that cuts a transparent hole for the center
  (`-webkit-mask: radial-gradient(circle, transparent 0 44px, #000 46px)`), `box-shadow: inset 0 0 0 1px rgba(255,255,255,.6)`.
- Petals: SVG `<path>` wedges radiating from center with small gaps; thin stroke
  (`stroke-width:.75`, `stroke: rgba(93,102,102,.22)`), translucent glass fill (white gradient);
  `.is-highlighted` petal → brand highlight fill (#FFED00) with darker stroke; label flips to ink/white as needed.
- Labels inside petals: rounded font (use Fredoka 600, 13px, letter-spacing .35px) + 8.5px tool label.
- Center: glass pill (white/78%, blur(12px), radius 24px, 1px white border, soft shadow) — in our design
  the center is the SOS button instead (see below).
- Whole wheel has `filter: drop-shadow(0 5px 8px rgba(38,52,56,.15))`.
- Hover/press micro-motion: petal lifts (subtle scale 1.02), highlight fill transition .12s.

## What to build

### A. `src/components/PetalWheel.jsx` (NEW)
A reusable inline-SVG wheel (viewBox 0 0 280 280), props: `{ items: [{id, label, icon, onClick, badge?}] }`
(max 6). Renders:
1. Behind: optional glass ring — either an HTML sibling div `.wheel-glass` (parent positions it) or an SVG
   circle with translucent fill + mask ring; must show the frosted-donut effect around the center hole.
2. 6 petal `<path>` targets at angles -90 + n*60 degrees. Petal = teardrop/wedge from inner radius ~58
   to outer ~128, width ~52° at outer edge, rounded corners (use path with quadratic curves or approximate
   with a rotated rounded-rect wedge — must look smooth, no sharp triangle). Per petal:
   - `<g transform="rotate(angle 140 140)">` containing the path + icon + text.
   - fill: url(#petalGlass) linear gradient rgba(255,255,255,.92)→rgba(241,239,230,.65); stroke rgba(23,22,15,.12) .75.
   - hover/active: fill var yellow #FFED00 (implement via CSS class `.petal.is-highlighted { fill:#FFED00 }`).
   - icon: 20px Feather-style inline SVG (stroke currentColor, 1.8, round caps), positioned upper part of petal.
   - label: `<text>` Fredoka 600 12.5px, centered under icon, fill --ink, letter-spacing .3px; short labels only
     (Patients, Vehicles, Doctor, 108, 112, Chat).
   - badge: if item.badge, small red circle + white "!" at petal outer corner.
   - cursor pointer, `role="menuitem"`, aria-label = label; keyboard: make each petal a focusable
     `<g tabIndex={0} role="button" onKeyDown={enter/space → onClick}>`.
3. Entrance bloom animation on mount (CSS class on the SVG root).
4. `filter: drop-shadow(0 6px 14px rgba(23,22,15,.14))`.
Events/labels come from props — Dashboard keeps its handlers (navigate / tel: anchors / WhatsApp).
For tel: and WhatsApp items, parent passes onClick (Dashboard will render nothing special — the wheel items
are all button-like onClick handlers; WhatsApp opens window.open, tel uses location.href — implement in
Dashboard as onClick handlers).

### B. `src/pages/Dashboard.jsx`
- Replace the current absolute-positioned `.radial-btn` ring with `<PetalWheel>`; keep items order:
  Patients (people icon → /patients), Vehicles (car icon → /vehicles, badge "!"), Doctor (stethoscope → /doctor),
  108 (phone/ambulance icon → tel:108), 112 (shield-phone → tel:112), Chat (message-circle → WhatsApp share
  with location text, window.open _blank).
- Center SOS: keep `.sos-btn` but **smaller**: `clamp(112px, 30vw, 134px)`; font 25px letter-spacing .06em;
  subtler pulse (ring opacity .45, 2.6s). SOS sits in the wheel's center hole (parent `.radial-center`).
- Wheel container: width/height `clamp(252px, 74vw, 300px)` centered (margin auto), relative; glass layer +
  PetalWheel + center SOS stacked. `--wheel-hole` for mask radius matches SOS size (hole radius ≈ 74px).
- Chips row + emergency select stay above the wheel (existing markup/logic). History/stats cards unchanged.
- Hide wheel while .emg-overlay open (existing conditional).
- Remove emoji from this page (use SVG icons incl. overlay action buttons: phone, chat, pin, siren-alert;
  device panel icons → SVG speaker/bell/lights/navigation arrows; keep flash CSS animations).

### C. Global polish (styles.css — edit/append, don't delete needed classes)
- Replace/retire `.radial-btn` styles (or keep unused harmlessly); add `.wheel-glass`, `.petal`,
  `.petal.is-highlighted`, `.bloom-in` keyframes, `.wheel-label`.
- Remove remaining emoji from UI chrome across App.jsx (brand: inline SVG ambulance cross, not 🚑),
  DoctorPage (banner call icon, approve check / refer share-2 / cancel x icons; initials-avatars: circle
  --sand bg ink text with 2-letter initials for doctors in refer rows and patients in feed),
  PatientsPage/VehiclesPage (trash-x, plus, chevron SVGs), AuthPage (SVG mark in yellow rounded square),
  footer (phone SVG). After pass: `rg -P "[\\x{1F300}-\\x{1FAFF}\\x{2600}-\\x{27BF}\\x{2700}-\\x{27BF}]" src/`
  must return NO UI emoji (report count).
- Buttons: .btn.primary yellow + soft shadow `0 6px 16px rgba(255,237,0,.35)` hover translateY(-1px);
  .btn.danger red shadow; transitions .15s; focus-visible outline 2px ink offset 2px.
- Cards: subtle layered shadow (0 1px 2px rgba(23,22,15,.04), 0 10px 28px rgba(23,22,15,.05));
  topbar shadow `0 1px 0 var(--border), 0 10px 30px rgba(23,22,15,.05)`.
- Page headers: eyebrow (13px 800 uppercase --label) above Fredoka h2 (e.g. "EMERGENCY HUB" / "One press to respond").
- Chips: 13.5px, padding 8px 14px, leading dot, selected = ink bg white text; group labels 11px 800 uppercase.
- ::selection yellow; input autocomplete tel/name.

### D. Verify
1. `npm run build` → exit 0.
2. `Invoke-WebRequest http://localhost:5173` → 200; `/api/health` ok:true (don't restart API).
3. Emoji audit count (expect 0 in src UI chrome).

## Report
PetalWheel design notes (angles, radii, gradient, bloom), SOS final size, per-file one-line changes,
build result, emoji audit, any omissions.