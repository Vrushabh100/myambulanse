import React, { useEffect, useId, useRef } from "react";
import "../loader.css";

export default function AmbulanceLoader({ sub, mini, title = "MyAmbulance" }) {
  const rootRef = useRef(null);
  const pfx = useId().replace(/:/g, "");
  useEffect(() => {
    // All id lookups are scoped to this instance's own root, so a splash and a
    // mini copy can coexist without #stage / #amb / ... colliding.
    var root = rootRef.current;
    if (!root) return;
    function q(id) { return root.querySelector("#" + pfx + "-" + id); }
    var FROZEN = null; // a number 0..1 pins the animation for testing; null runs it
    var rafId = 0;

    /* ---------- scene geometry ---------- */
    var CX = 240, CY = 140, RX = 190, RY = 64, K = RY / RX;
    var T0 = Math.PI + 0.08;          // arc starts hidden behind the globe, back left
    var T1 = 2 * Math.PI + 0.5;       // arc ends at the front right, open, not joined to the start
    var TM = 1.5 * Math.PI;           // left-most point: the road passes from behind to in front of the globe
    var TS = TM + 0.55;               // middle of the split: the car turns into the ambulance here
    var GAP = 0.07;                   // half-width of the gap between the two road parts (radians)

    function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function F(t) { return (Math.cos(t) + 1) / 2; }
    function half(t) {
      var u = (t - T0) / (T1 - T0);
      var taper = 0.18 + 0.82 * Math.min(smooth(u / 0.09), smooth((1 - u) / 0.14));
      return (3.5 + 16 * Math.pow(F(t), 1.15)) * taper;
    }
    function P(t, w) { return [CX + (RX + w) * Math.sin(t), CY + (RY + w * K) * Math.cos(t)]; }
    function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L'); }

    function buildRoad(ta, tb, ids) {
      var n = 48, o = [], i = [];
      for (var k = 0; k <= n; k++) {
        var t = ta + (tb - ta) * k / n, w = half(t);
        o.push(P(t, w)); i.push(P(t, -w));
      }
      q(ids[0]).setAttribute('d', 'M' + pts(o) + 'L' + pts(i.slice().reverse()) + 'Z');
      q(ids[1]).setAttribute('d', 'M' + pts(o));
      q(ids[2]).setAttribute('d', 'M' + pts(i));
    }
    buildRoad(T0, TM, ['bRoad', 'bEdgeO', 'bEdgeI']);           // part 1 (car), behind the globe
    buildRoad(TM, TS - GAP, ['fRoad', 'fEdgeO', 'fEdgeI']);     // part 1 (car), in front of the globe
    buildRoad(TS + GAP, T1, ['gRoad', 'gEdgeO', 'gEdgeI']);     // part 2 (ambulance)

    // transform gate: a glowing pad in the gap plus amber caps on both road ends
    var wa = half(TS - GAP), wb = half(TS + GAP);
    q('pad').setAttribute('d', 'M' + pts([P(TS - GAP, wa), P(TS + GAP, wb), P(TS + GAP, -wb), P(TS - GAP, -wa)]) + 'Z');
    q('caps').setAttribute('d',
      'M' + pts([P(TS - GAP, wa), P(TS - GAP, -wa)]) + 'M' + pts([P(TS + GAP, wb), P(TS + GAP, -wb)]));

    var dB = '', dF = '';
    for (var t = T0 + 0.17; t + 0.06 < T1 - 0.12; t += 0.12) {
      if (t + 0.06 > TS - GAP - 0.02 && t < TS + GAP + 0.02) continue;   // no dashes inside the gap
      var dw = 0.5 + 1.2 * F(t);
      var seg = 'M' + pts([P(t, dw), P(t + 0.06, dw), P(t + 0.06, -dw), P(t, -dw)]) + 'Z';
      if (Math.cos(t) < 0) dB += seg; else dF += seg;
    }
    q('bDash').setAttribute('d', dB);
    q('fDash').setAttribute('d', dF);

    /* ---------- 3D ambulance (model units: x forward, y down, z toward viewer; ground at y = 0) ---------- */
    var rig = q('rig');
    if (!rig) return;
    // Idempotent rebuild: React StrictMode can mount this effect twice on the
    // same DOM, so always start from an empty rig before appending the groups.
    while (rig.firstChild) rig.removeChild(rig.firstChild);
    var shaded = [], cur = rig;
    var gCar = document.createElement('div'), gAmb = document.createElement('div');
    gCar.className = gAmb.className = 'grp';
    rig.appendChild(gCar); rig.appendChild(gAmb);

    function plane(o) {
      var el = document.createElement('div');
      el.className = 'p ' + (o.cls || '');
      el.style.width = o.w + 'px';
      el.style.height = o.h + 'px';
      el.style.transform = 'translate3d(' + o.x + 'px,' + o.y + 'px,' + o.z + 'px) ' + (o.r || '') +
        ' translate(' + (-o.w / 2) + 'px,' + (-o.h / 2) + 'px)';
      if (o.html) el.innerHTML = o.html;
      if (o.n) shaded.push({ el: el, n: o.n });
      cur.appendChild(el);
      return el;
    }
    function box(cx, cy, cz, w, h, d, cls) {
      plane({ w: w, h: d, x: cx, y: cy - h / 2, z: cz, r: 'rotateX(90deg)', cls: cls, n: [0, -1, 0] });
      plane({ w: w, h: h, x: cx, y: cy, z: cz + d / 2, cls: cls, n: [0, 0, 1] });
      plane({ w: w, h: h, x: cx, y: cy, z: cz - d / 2, r: 'rotateY(180deg)', cls: cls, n: [0, 0, -1] });
      plane({ w: d, h: h, x: cx + w / 2, y: cy, z: cz, r: 'rotateY(90deg)', cls: cls, n: [1, 0, 0] });
      plane({ w: d, h: h, x: cx - w / 2, y: cy, z: cz, r: 'rotateY(-90deg)', cls: cls, n: [-1, 0, 0] });
    }

    // textures: class-coloured SVG, so every colour comes from the CSS variables
    function mirror(inner, flip, over) {
      return '<svg viewBox="-50 -50 102 40" width="102" height="40"><g' + (flip ? ' transform="translate(2,0) scale(-1,1)"' : '') + '>' + inner + '</g>' + (over || '') + '</svg>';
    }
    // text is not mirrored on the far side: it sits at the mirrored x, so it reads correctly from both sides
    function label(flip, cx, cy, size, str, fill) {
      return '<text x="' + (flip ? 2 - cx : cx) + '" y="' + cy + '" text-anchor="middle" font-family="Outfit, Segoe UI, sans-serif" font-weight="700" font-size="' + size + '" letter-spacing=".4" fill="' + fill + '">' + str + '</text>';
    }
    var AMB_SIL = 'M-47,-10 Q-50,-10 -50,-13 L-50,-47 Q-50,-50 -47,-50 L7,-50 Q10,-50 10,-47 L10,-40 L20,-40 Q22,-40 23.5,-38.5 L34.5,-25.5 Q36,-24 38,-23.8 L49,-22.4 Q52,-22 52,-19 L52,-13 Q52,-10 49,-10 Z';
    var CAR_SIL = 'M-45,-10 Q-48,-10 -48,-13 L-48,-24.5 Q-48,-27 -45.5,-27.5 L-44.5,-28.5 L-36,-40.5 Q-34.5,-42 -32,-42 L8,-42 Q10.5,-42 12,-40.5 L26.5,-28.5 Q28,-27 30,-26.6 L46,-25 Q50,-24.6 50,-21 L50,-13 Q50,-10 47,-10 Z';

    function ambSide(flip) {
      return mirror(
        '<path class="k1" d="M-47,-10 Q-50,-10 -50,-13 L-50,-47 Q-50,-50 -47,-50 L7,-50 Q10,-50 10,-47 L10,-10 Z"/>' +
        '<path class="k2" d="M10,-10 L10,-37 Q10,-40 13,-40 L20,-40 Q22,-40 23.5,-38.5 L34.5,-25.5 Q36,-24 38,-23.8 L49,-22.4 Q52,-22 52,-19 L52,-13 Q52,-10 49,-10 Z"/>' +
        '<rect x="-47" y="-48.6" width="52" height="1.2" rx=".6" fill="#fff" opacity=".6"/>' +
        '<rect class="k3" x="-50" y="-27" width="60" height="7"/><rect class="k3" x="-50" y="-29.6" width="60" height="1"/>' +
        '<rect class="k3" x="-44" y="-42" width="16" height="6" rx="1.2"/><rect class="k3" x="-39" y="-47" width="6" height="16" rx="1.2"/>' +
        '<path d="M-24,-39 L-19,-39 L-16.5,-45 L-12.5,-33 L-9.5,-39 L-6,-39" fill="none" style="stroke:var(--amb-trim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<line x1="2" y1="-47" x2="2" y2="-29.6" stroke="#D9C3AE" stroke-width=".8"/>' +
        '<polygon class="kg" points="13.5,-37.5 21,-37.5 31,-26 13.5,-26"/>' +
        '<rect x="14" y="-23" width="6" height="1.6" rx=".8" fill="#C9B7A5"/><rect x="30" y="-28" width="4" height="3" rx="1" fill="#2E2226"/>' +
        '<rect x="48.5" y="-21" width="3.5" height="3.4" rx="1" fill="#FFE27A"/><rect x="-50" y="-44" width="2.6" height="7" rx="1" fill="#FF2D55"/>' +
        '<rect x="-50" y="-15" width="102" height="5" rx="2" fill="#D9C3AE"/>' +
        '<circle cx="-30" cy="-9" r="11" fill="#2E2226"/><circle cx="34" cy="-9" r="11" fill="#2E2226"/>' +
        '<path class="sh" d="' + AMB_SIL + '"/>', flip, label(flip, -20, -21.6, 5, 'AMBULANCE', '#fff'));
    }
    function carSide(flip) {
      return mirror(
        '<path class="c1" d="' + CAR_SIL + '"/>' +
        '<polygon class="kg" points="-41,-28 -33,-39.5 -9,-39.5 -9,-28"/>' +
        '<polygon class="kg" points="-5,-28 -5,-39.5 9,-39.5 21,-28"/>' +
        '<line x1="-7" y1="-27" x2="-7" y2="-12" style="stroke:var(--car-dark)" stroke-width=".8"/><line x1="17" y1="-27" x2="17" y2="-12" style="stroke:var(--car-dark)" stroke-width=".8"/>' +
        '<rect class="c2" x="-47" y="-14" width="96" height="4" rx="1.5"/>' +
        '<rect x="-48" y="-19" width="98" height="2.4" fill="#FFE8C2"/>' +
        '<polygon points="-43,-26.5 -35,-40.5 -30.5,-40.5 -39,-26.5" fill="#fff" opacity=".2"/>' +
        '<circle cx="-18" cy="-23.2" r="4.6" fill="#fff" style="stroke:var(--car-dark)" stroke-width=".8"/>' +
        '<rect class="c2" x="38" y="-23" width="6" height="1.4" rx=".7"/><rect class="c2" x="38" y="-20.6" width="6" height="1.4" rx=".7"/>' +
        '<rect x="-3" y="-24" width="6" height="1.6" rx=".8" fill="#fff" opacity=".8"/>' +
        '<rect class="c2" x="15" y="-30" width="5" height="3" rx="1"/>' +
        '<rect x="-48" y="-25" width="3.5" height="4" rx="1" fill="#FF2D55"/><rect x="46" y="-23" width="4" height="3.5" rx="1" fill="#FFE27A"/>' +
        '<circle cx="-28" cy="-9" r="11" fill="#2E2226"/><circle cx="32" cy="-9" r="11" fill="#2E2226"/>' +
        '<path class="sh" d="' + CAR_SIL + '"/>', flip, label(flip, -18, -21.4, 6.5, '7', '#C2421A'));
    }
    var ambRear = (function () {
      var chev = '';
      for (var i = -1; i < 6; i++) { var x = i * 9; chev += '<polygon class="k3" points="' + x + ',34 ' + (x + 4.5) + ',34 ' + (x + 8.5) + ',27 ' + (x + 4) + ',27"/>'; }
      return '<svg viewBox="0 0 44 40" width="44" height="40">' +
        '<rect class="k1" width="44" height="40"/>' +
        '<rect class="kg" x="4" y="3" width="15" height="8" rx="2"/><rect class="kg" x="25" y="3" width="15" height="8" rx="2"/>' +
        '<rect class="k3" x="19.5" y="12.5" width="5" height="13.5" rx="1"/><rect class="k3" x="14" y="16.5" width="16" height="5" rx="1"/>' +
        '<line x1="22" y1="1" x2="22" y2="12" stroke="#D9C3AE" stroke-width=".8"/>' +
        chev +
        '<rect y="34" width="44" height="6" fill="#D9C3AE"/>' +
        '<rect x="2" y="35.5" width="6" height="3" rx="1" fill="#FF2D55"/><rect x="36" y="35.5" width="6" height="3" rx="1" fill="#FF2D55"/>' +
        '</svg>';
    })();
    var ambFront = '<svg viewBox="0 0 44 12" width="44" height="12">' +
      '<rect class="k2" width="44" height="12"/><rect class="k3" y="5.2" width="44" height="1.4"/><rect y="8" width="44" height="4" fill="#D9C3AE"/>' +
      '<rect x="15" y="1.5" width="14" height="3.2" rx="1" fill="#2E2226"/>' +
      '<circle cx="7" cy="4" r="2.6" fill="#FFD76A"/><circle cx="37" cy="4" r="2.6" fill="#FFD76A"/>' +
      '</svg>';
    var carRear = '<svg viewBox="0 0 38 17" width="38" height="17">' +
      '<rect class="c1" width="38" height="17"/>' +
      '<rect x="2" y="3" width="8" height="4" rx="1" fill="#FF2D55"/><rect x="28" y="3" width="8" height="4" rx="1" fill="#FF2D55"/><rect x="10" y="4.5" width="18" height="1" fill="#FF2D55" opacity=".6"/>' +
      '<rect x="13" y="8" width="12" height="5" rx="1" fill="#fff" opacity=".9"/><rect x="15" y="10" width="8" height="1" fill="#2E2226" opacity=".6"/>' +
      '<rect class="c2" y="13" width="38" height="4"/><circle cx="7" cy="15" r="1.3" fill="#2E2226"/><circle cx="31" cy="15" r="1.3" fill="#2E2226"/>' +
      '</svg>';
    var carFront = '<svg viewBox="0 0 38 15" width="38" height="15">' +
      '<rect class="c1" width="38" height="15"/><rect x="12" y="6" width="14" height="4" rx="1" fill="#2E2226"/><rect x="13" y="7.2" width="12" height="1" fill="#FFE8C2" opacity=".7"/>' +
      '<circle cx="6" cy="5" r="2.8" fill="#FFD76A"/><circle cx="32" cy="5" r="2.8" fill="#FFD76A"/>' +
      '<rect class="c2" y="11" width="38" height="4"/><rect x="4" y="12.2" width="6" height="1.6" rx=".8" fill="#FFE27A"/><rect x="28" y="12.2" width="6" height="1.6" rx=".8" fill="#FFE27A"/>' +
      '</svg>';
    var roofCross = '<svg viewBox="0 0 60 44" width="60" height="44"><circle cx="30" cy="22" r="17" style="fill:none;stroke:var(--amb-trim)" stroke-width="2.4"/><rect class="k3" x="26" y="8" width="8" height="28"/><rect class="k3" x="16" y="18" width="28" height="8"/></svg>';

    function wheels(xs, zs, zr) {
      xs.forEach(function (wx) {
        [1, -1].forEach(function (sg) {
          zs.forEach(function (zz) { plane({ w: 18, h: 18, x: wx, y: -9, z: sg * zz, cls: 'tire' }); });
          plane({ w: 18, h: 18, x: wx, y: -9, z: sg * zr, r: sg < 0 ? 'rotateY(180deg)' : '',
            cls: 'rim', html: '<i class="hub"></i>', n: [0, 0, sg] });
        });
      });
    }

    // ambulance (part 2)
    cur = gAmb;
    plane({ w: 102, h: 40, x: 1, y: -30, z: 22, cls: 'noov', html: ambSide(false), n: [0, 0, 1] });
    plane({ w: 102, h: 40, x: 1, y: -30, z: -22, r: 'rotateY(180deg)', cls: 'noov', html: ambSide(true), n: [0, 0, -1] });
    plane({ w: 60, h: 44, x: -20, y: -50, z: 0, r: 'rotateX(90deg)', cls: 'roofc noov rr', html: roofCross, n: [0, -1, 0] });
    plane({ w: 12, h: 44, x: 16, y: -40, z: 0, r: 'rotateX(90deg)', cls: 'roofl', n: [0, -1, 0] });
    plane({ w: 21.3, h: 44, x: 29, y: -32, z: 0, r: 'rotateZ(48.8deg) rotateX(90deg)', cls: 'glass', n: [0.75, -0.66, 0] });
    plane({ w: 16.1, h: 44, x: 44, y: -23, z: 0, r: 'rotateZ(7deg) rotateX(90deg)', cls: 'hood rf', n: [0.12, -0.99, 0] });
    plane({ w: 44, h: 12, x: 52, y: -16, z: 0, r: 'rotateY(90deg)', cls: 'noov rb', html: ambFront, n: [1, 0, 0] });
    plane({ w: 44, h: 10, x: 10, y: -45, z: 0, r: 'rotateY(90deg)', cls: 'step', n: [1, 0, 0] });
    plane({ w: 44, h: 40, x: -50, y: -30, z: 0, r: 'rotateY(-90deg)', cls: 'rb', html: ambRear, n: [-1, 0, 0] });
    box(-6, -53, -9.5, 8, 6, 17, 'lt lr');
    box(-6, -53, 9.5, 8, 6, 17, 'lt lb');
    wheels([-30, 34], [16, 18, 20, 22], 22.7);

    // car (part 1)
    cur = gCar;
    plane({ w: 102, h: 40, x: 1, y: -30, z: 19, cls: 'noov', html: carSide(false), n: [0, 0, 1] });
    plane({ w: 102, h: 40, x: 1, y: -30, z: -19, r: 'rotateY(180deg)', cls: 'noov', html: carSide(true), n: [0, 0, -1] });
    plane({ w: 44, h: 38, x: -12, y: -42, z: 0, r: 'rotateX(90deg)', cls: 'croof rr', n: [0, -1, 0] });
    plane({ w: 23.4, h: 38, x: 19, y: -34.5, z: 0, r: 'rotateZ(39.8deg) rotateX(90deg)', cls: 'glass', n: [0.64, -0.77, 0] });
    plane({ w: 22.1, h: 38, x: 39, y: -26, z: 0, r: 'rotateZ(5.2deg) rotateX(90deg)', cls: 'chood rf', n: [0.09, -1, 0] });
    plane({ w: 44, h: 7, x: -12, y: -42.6, z: 0, r: 'rotateX(90deg)', cls: 'cstripe', n: [0, -1, 0] });
    plane({ w: 22.1, h: 7, x: 39, y: -26.6, z: 0, r: 'rotateZ(5.2deg) rotateX(90deg)', cls: 'cstripe', n: [0.09, -1, 0] });
    plane({ w: 18, h: 38, x: -39, y: -34.5, z: 0, r: 'rotateZ(-56.3deg) rotateX(90deg)', cls: 'glass', n: [-0.83, -0.55, 0] });
    plane({ w: 38, h: 15, x: 50, y: -17.5, z: 0, r: 'rotateY(90deg)', cls: 'noov rb', html: carFront, n: [1, 0, 0] });
    plane({ w: 38, h: 17, x: -48, y: -18.5, z: 0, r: 'rotateY(-90deg)', cls: 'rb', html: carRear, n: [-1, 0, 0] });
    box(-37, -42.8, 0, 7, 1.6, 34, 'cs');   // rear spoiler
    wheels([-28, 32], [13, 15, 17, 19], 19.7);

    var LX = -0.415, LY = -0.784, LZ = 0.461; // light direction in the scene (from upper left, toward the viewer)
    function shade(a) {
      var c = Math.cos(a), s = Math.sin(a);
      for (var i = 0; i < shaded.length; i++) {
        var n = shaded[i].n;
        var nx = n[0] * c + n[2] * s, nz = -n[0] * s + n[2] * c;
        var lam = Math.max(0, nx * LX + n[1] * LY + nz * LZ);
        shaded[i].el.style.setProperty('--sh', (0.42 * (1 - lam)).toFixed(3));
      }
    }

    /* ---------- animation ---------- */
    var stage = q('stage');
    var amb = q('amb');
    var shadow = q('shadow');
    var pad = q('pad');
    var rings = root.querySelectorAll('#' + pfx + '-fx .ring'), sparks = root.querySelectorAll('#' + pfx + '-fx .sp');
    if (!stage || !amb || !shadow || !pad) return;
    var TRAVEL = 3.6, REST = 0.45;
    var stageW = stage.clientWidth;
    function measure() { stageW = stage.clientWidth; }

    function ease(u) { return 0.55 * u + 0.45 * (1 - (1 - u) * (1 - u)); }   // quick start, soft arrival
    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    // progress at which the vehicle reaches the middle of the gap
    var uS = (function () {
      var lo = 0, hi = 1;
      for (var i = 0; i < 30; i++) {
        var mid = (lo + hi) / 2;
        if (T0 + (T1 - T0) * ease(mid) < TS) lo = mid; else hi = mid;
      }
      return lo;
    })();

    function render(u) {
      var t = T0 + (T1 - T0) * ease(u);
      var d = Math.cos(t), f = (d + 1) / 2;
      var x = CX + RX * Math.sin(t), y = CY + RY * d;
      var s = 0.28 + 0.66 * Math.pow(f, 1.35);               // small behind, big in front
      var vis = Math.min(smooth(u / 0.06), smooth((1 - u) / 0.05));
      var o = (0.6 + 0.4 * Math.pow(f, 0.6)) * vis;
      var k = stageW / 480;

      // transform moment: car before the gap middle, ambulance after it, with a pop and a burst on the swap
      var isAmb = u >= uS;
      gCar.style.display = isAmb ? 'none' : '';
      gAmb.style.display = isAmb ? '' : 'none';
      var pop = 1 + 0.18 * Math.sin(Math.PI * clamp01((u - (uS - 0.05)) / 0.1));
      var b = clamp01((u - (uS - 0.01)) / 0.16), live = b > 0 && b < 1;
      var b2 = clamp01((b - 0.2) / 0.8);
      rings[0].style.opacity = live ? ((1 - b) * 0.9).toFixed(3) : 0;
      rings[0].style.transform = 'scale(' + (0.25 + 1.6 * b).toFixed(3) + ')';
      rings[1].style.opacity = live ? ((1 - b2) * 0.9).toFixed(3) : 0;
      rings[1].style.transform = 'scale(' + (0.2 + 1.9 * b2).toFixed(3) + ')';
      for (var i = 0; i < sparks.length; i++) {
        var a = i / sparks.length * 2 * Math.PI + 0.5, r = 18 + 62 * b;
        sparks[i].style.opacity = live ? (1 - b).toFixed(3) : 0;
        sparks[i].style.transform = 'translate(' + (Math.cos(a) * r).toFixed(1) + 'px,' + (Math.sin(a) * r * 0.8).toFixed(1) + 'px) scale(' + (1 - 0.5 * b).toFixed(2) + ')';
      }
      pad.style.opacity = (0.18 + 0.7 * Math.max(0, 1 - Math.abs(u - uS) / 0.16)).toFixed(3);

      amb.style.transform = 'translate(' + (x * k).toFixed(2) + 'px,' + ((y - 48) * k).toFixed(2) + 'px) scale(' + (s * pop * k).toFixed(4) + ')';
      amb.style.opacity = o.toFixed(3);
      amb.style.zIndex = d >= 0 ? 5 : 2;
      rig.style.transform = 'rotateX(-20deg) rotateY(' + (t * 180 / Math.PI).toFixed(2) + 'deg)';

      var ca = Math.abs(Math.cos(t)), sa = Math.abs(Math.sin(t));
      var sw = 100 * ca + 46 * sa + 14, sh = (46 * ca + 100 * sa) * 0.34 + 9;
      shadow.style.width = sw.toFixed(1) + 'px';
      shadow.style.height = sh.toFixed(1) + 'px';
      shadow.style.transform = 'translate(' + (1 - sw / 2).toFixed(1) + 'px,' + (-sh / 2 + 1).toFixed(1) + 'px)';
      shade(t);
    }

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (FROZEN !== null || reduce) {
      render(FROZEN !== null ? FROZEN : 0.78);
      return;
    }
    // Run the loop only while the tab is visible; resume where it left off.
    var start = null, running = false, pausedAt = 0, lastDraw = 0;
    function frame(now) {
      if (start === null) start = now;
      if (mini && now - lastDraw < 32) { rafId = requestAnimationFrame(frame); return; }
      lastDraw = now;
      var sec = ((now - start) / 1000) % (TRAVEL + REST);
      render(Math.min(1, sec / TRAVEL));
      rafId = requestAnimationFrame(frame);
    }
    function play() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    }
    function pause() {
      running = false;
      cancelAnimationFrame(rafId);
    }
    function onVisibility() {
      if (document.hidden) {
        if (running) { pausedAt = performance.now(); pause(); }
      } else if (!running && pausedAt) {
        start += performance.now() - pausedAt;
        pausedAt = 0;
        play();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', measure);
    requestAnimationFrame(measure);
    render(0.6);
    if (document.hidden) pausedAt = performance.now(); else play();

    return function () {
      pause();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', measure);
    };
  }, [pfx]);

  return (
    <div
      ref={rootRef}
      className={mini ? "ma-loader ma-mini" : "ma-loader"}
      {...(mini ? { role: "img", "aria-label": "Ambulance loading animation" } : {})}
    >
      <div className="stage" id={`${pfx}-stage`} aria-hidden="true">
        {/* back half of the road, behind the globe */}
        <svg className="layer l-back" viewBox="0 48 480 190" focusable="false">
          <path id={`${pfx}-bRoad`} className="road" />
          <path id={`${pfx}-bEdgeO`} className="edge" />
          <path id={`${pfx}-bEdgeI`} className="edge" />
          <path id={`${pfx}-bDash`} className="dash" />
        </svg>

        {/* ambulance; its stacking position switches between behind and in front of the globe */}
        <div className="amb" id={`${pfx}-amb`}>
          <div className="shadow" id={`${pfx}-shadow`} />
          <div className="persp"><div className="rig" id={`${pfx}-rig`} /></div>
          <div className="fx" id={`${pfx}-fx`}><i className="ring" /><i className="ring r2" /><i className="sp" /><i className="sp" /><i className="sp" /><i className="sp" /><i className="sp" /><i className="sp" /></div>
        </div>

        {/* globe */}
        <svg className="layer l-globe" viewBox="0 48 480 190" focusable="false">
          <defs>
            <clipPath id={`${pfx}-cGlobe`}><circle cx="240" cy="140" r="72" /></clipPath>
            <mask id={`${pfx}-crescent`}><rect x="160" y="60" width="160" height="160" fill="#fff" /><circle cx="228" cy="128" r="72" fill="#000" /></mask>
          </defs>

          <circle className="halo" cx="240" cy="140" r="84" fill="var(--halo)" />
          <circle cx="240" cy="140" r="72" fill="var(--ocean-2)" />

          <g clipPath={`url(#${pfx}-cGlobe)`}>
            {/* continents slide sideways in a seamless loop, so the planet turns */}
            <g className="drift">
              <g id={`${pfx}-lands`}>
                <path className="ld" d="M182,96 C192,80 220,76 236,86 C252,94 250,108 240,116 C246,128 232,140 218,138 C210,150 196,152 190,140 C184,130 190,122 184,114 C178,108 178,102 182,96Z" />
                <path className="ld" d="M278,100 C292,92 312,96 322,108 C332,120 322,132 310,134 C316,146 304,160 292,156 C282,150 286,140 278,134 C268,126 266,108 278,100Z" />
                <path className="ld" d="M214,170 C228,162 248,166 256,178 C262,190 246,200 232,198 C218,196 206,182 214,170Z" />
                <path className="ld" d="M340,160 C352,152 372,156 376,170 C380,184 362,194 350,190 C338,184 332,170 340,160Z" />
                <path className="ld" d="M396,92 C410,84 430,90 434,104 C438,118 420,124 408,120 C394,114 388,100 396,92Z" />
                <ellipse className="ld" cx="262" cy="150" rx="8" ry="5" />
                <ellipse className="ld" cx="300" cy="184" rx="10" ry="6" />
                <ellipse className="ld" cx="388" cy="150" rx="9" ry="5" />
                <ellipse className="ld" cx="330" cy="82" rx="8" ry="4" />
                <rect className="cl" x="196" y="150" width="22" height="6" rx="3" /><rect className="cl" x="318" y="168" width="26" height="6" rx="3" /><rect className="cl" x="250" y="90" width="20" height="5" rx="2.5" /><rect className="cl" x="372" y="128" width="24" height="6" rx="3" /><rect className="cl" x="424" y="150" width="22" height="6" rx="3" />
                <g className="pin"><circle className="rip" cx="232" cy="108" r="3" /><circle cx="232" cy="108" r="2.6" /></g>
                <g className="pin"><circle className="rip" cx="300" cy="118" r="3" style={{ animationDelay: '.7s' }} /><circle cx="300" cy="118" r="2.6" /></g>
                <g className="pin"><circle className="rip" cx="360" cy="172" r="3" style={{ animationDelay: '1.3s' }} /><circle cx="360" cy="172" r="2.6" /></g>
                <g className="pin"><circle className="rip" cx="416" cy="104" r="3" style={{ animationDelay: '.3s' }} /><circle cx="416" cy="104" r="2.6" /></g>
              </g>
              <use href={`#${pfx}-lands`} x="288" />
            </g>
            <g className="gridl">
              <path d="M177.6,104 Q240,120 302.4,104" />
              <path d="M168,140 Q240,154 312,140" />
              <path d="M177.6,176 Q240,190 302.4,176" />
              <ellipse cx="240" cy="140" rx="34" ry="72" />
            </g>

            {/* heartbeat line across the planet */}
            <path className="ecg0" d="M170,140 L198,140 L208,140 L214,126 L222,160 L230,108 L238,152 L244,140 L252,140 L258,134 L264,140 L310,140" />
            <path className="ecg1" pathLength="100" d="M170,140 L198,140 L208,140 L214,126 L222,160 L230,108 L238,152 L244,140 L252,140 L258,134 L264,140 L310,140" />
          </g>

          <circle cx="240" cy="140" r="72" fill="#4A1A05" fillOpacity="0.3" mask={`url(#${pfx}-crescent)`} />

          <circle className="atmo" cx="240" cy="140" r="73.5" />
          <ellipse cx="208" cy="96" rx="24" ry="11" fill="#fff" opacity="0.2" transform="rotate(-32 208 96)" />
          <ellipse cx="204" cy="92" rx="10" ry="4.5" fill="#fff" opacity="0.5" transform="rotate(-32 204 92)" />

          <g transform="translate(176,60)"><path className="tw" d="M0,-6 L1.6,-1.6 L6,0 L1.6,1.6 L0,6 L-1.6,1.6 L-6,0 L-1.6,-1.6Z" /></g>
          <g transform="translate(314,58)"><path className="tw t2" d="M0,-6 L1.6,-1.6 L6,0 L1.6,1.6 L0,6 L-1.6,1.6 L-6,0 L-1.6,-1.6Z" /></g>
          <g transform="translate(348,108)"><path className="tw t3" d="M0,-5 L1.3,-1.3 L5,0 L1.3,1.3 L0,5 L-1.3,1.3 L-5,0 L-1.3,-1.3Z" /></g>
        </svg>

        {/* front half of the road, in front of the globe */}
        <svg className="layer l-front" viewBox="0 48 480 190" focusable="false">
          <path id={`${pfx}-pad`} className="pad" />
          <path id={`${pfx}-fRoad`} className="road" />
          <path id={`${pfx}-fEdgeO`} className="edge" />
          <path id={`${pfx}-fEdgeI`} className="edge" />
          <path id={`${pfx}-gRoad`} className="road" />
          <path id={`${pfx}-gEdgeO`} className="edge" />
          <path id={`${pfx}-gEdgeI`} className="edge" />
          <path id={`${pfx}-fDash`} className="dash" />
          <path id={`${pfx}-caps`} className="cap" />
        </svg>
      </div>

      {!mini && (
        <>
          <h1 className="title">
            {title}
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </h1>
          {sub ? <p className="sub" role="status">{sub}</p> : null}
        </>
      )}
    </div>
  );
}
