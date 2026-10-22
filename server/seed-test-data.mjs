#!/usr/bin/env node
/**
 * MyAmbulance test-data seeder (idempotent, safe to re-run).
 *
 * Talks ONLY to the real public API on http://localhost:5050 via fetch.
 * Never touches the database directly, never deletes/updates records it did
 * not create in this run. Existing (same-name patient / same-reg car /
 * same-user emergency) records are skipped, not modified.
 *
 * Usage:  node seed-test-data.mjs          (from the server/ directory)
 */

const API = "http://localhost:5050/api";
const RETRIES = 3;

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body != null ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, ok: res.ok, data };
}

async function withRetry(fn, label, tries = RETRIES) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries) {
        console.warn(`  ! ${label}: attempt ${i} failed (${e.message}) — retrying`);
        await sleep(400 * i);
      }
    }
  }
  throw lastErr;
}

function nagpurLocation() {
  return {
    lat: +(21.1456 + (Math.random() - 0.5) * 0.08).toFixed(6),
    lng: +(79.0821 + (Math.random() - 0.5) * 0.08).toFixed(6),
    accuracy: Math.round(8 + Math.random() * 20)
  };
}

/* ------------------------------------------------------------------ */
/* seed data                                                           */
/* ------------------------------------------------------------------ */

const DOCTORS = [
  { name: "Aarav Sharma", mobile: "9822000001", degree: "MD", specialization: "Cardiology", address: "Dhantoli, Nagpur" },
  { name: "Priya Deshmukh", mobile: "9822000002", degree: "MS", specialization: "Neurology", address: "Panchavati, Nashik" },
  { name: "Rohan Singh", mobile: "9822000003", degree: "MBBS", specialization: "Orthopedics", address: "Shivaji Nagar, Pune" },
  { name: "Ananya Verma", mobile: "9822000004", degree: "MD", specialization: "Pediatrics", address: "Sadar, Nagpur" },
  { name: "Kabir Nair", mobile: "9822000005", degree: "MS", specialization: "Trauma Surgery", address: "Sitabuldi, Nagpur" }
];

const USERS = [
  {
    mobile: "9822000101", name: "Rahul Sharma", address: "Nagpur, Maharashtra",
    patient: {
      name: "Suresh Sharma", relation: "Father", age: 62, gender: "Male", bloodGroup: "B+",
      diseases: ["Diabetes", "Hypertension"], allergies: ["Penicillin"],
      defaultEmergency: "Heart attack / Chest pain",
      doctorMobile: "9822000001",
      contacts: [
        { name: "Meena Sharma", mobile: "9822000191", relation: "Wife" },
        { name: "Ritu Sharma", mobile: "9822000192", relation: "Sister" }
      ],
      tracker: [
        { note: "Morning walk done, BP normal", bp: "128/84", heartRate: "78" },
        { note: "Chest tightness episode for 2 min, took prescribed tablet", bp: "142/90", heartRate: "96", sugar: "168" },
        { note: "Routine checkup — reports attached with family", bp: "130/86", weight: "72kg" }
      ]
    },
    car: { registrationNo: "MH31AB1101", vehicleModel: "Maruti Swift", color: "White", deviceA: "TSTA01", deviceB: "TSTB01" },
    demoEmergency: {
      note: "ECG normal, chest pain relieved after monitoring; continue cardiac medicines"
    }
  },
  {
    mobile: "9822000102", name: "Priya Kulkarni", address: "Pune, Maharashtra",
    patient: {
      name: "Ashok Kulkarni", relation: "Father", age: 58, gender: "Male", bloodGroup: "O+",
      diseases: ["Asthma"], allergies: ["Penicillin"],
      defaultEmergency: "Breathing difficulty",
      doctorMobile: "9822000003",
      contacts: [
        { name: "Sunita Kulkarni", mobile: "9822000193", relation: "Wife" }
      ],
      tracker: [
        { note: "Inhaler used twice in the evening, breathing settled", bp: "132/86", heartRate: "88" },
        { note: "Neighbour smoking near building — wheezing started, used inhaler", heartRate: "102", bp: "138/88" },
        { note: "Pulmonology follow-up done, peak flow improved", weight: "78kg", bp: "128/82" }
      ]
    },
    car: { registrationNo: "MH31AB1102", vehicleModel: "Hyundai Creta", color: "Silver", deviceA: "TSTA02", deviceB: "TSTB02" },
    demoEmergency: {
      note: "Stable after nebulization; advised hospital visit"
    }
  },
  {
    mobile: "9822000103", name: "Amit Patil", address: "Nashik, Maharashtra",
    patient: {
      name: "Sunita Patil", relation: "Mother", age: 55, gender: "Female", bloodGroup: "A+",
      diseases: ["Thyroid", "Arthritis"], allergies: ["Sulfa drugs"],
      defaultEmergency: "General emergency",
      doctorMobile: "9822000002",
      contacts: [
        { name: "Amit Patil", mobile: "9822000103", relation: "Son" },
        { name: "Gita Patil", mobile: "9822000194", relation: "Aunt" }
      ],
      tracker: [
        { note: "Thyroid tablet taken empty stomach", weight: "64kg" },
        { note: "Knee pain increased after stair climbing", weight: "64kg", bp: "124/80" },
        { note: "Endocrine review — TSH under control", bp: "126/80", weight: "63kg" }
      ]
    },
    car: { registrationNo: "MH31AB1103", vehicleModel: "Tata Nexon", color: "Blue", deviceA: "TSTA03", deviceB: "TSTB03" },
    demoEmergency: null // this user carries the OPEN referred demo case instead
  },
  {
    mobile: "9822000104", name: "Sneha Kulkarni", address: "Amravati, Maharashtra",
    patient: {
      name: "Sneha Kulkarni", relation: "Self", age: 28, gender: "Female", bloodGroup: "AB+",
      diseases: ["Migraine"], allergies: ["No known allergies"],
      defaultEmergency: "Stroke symptoms",
      doctorMobile: "9822000004",
      contacts: [
        { name: "Mahesh Kulkarni", mobile: "9822000195", relation: "Husband" }
      ],
      tracker: [
        { note: "Migraine mild, screen break helped", heartRate: "84" },
        { note: "Attack at work — dark room + prescribed tablet, recovered in 1 hr", heartRate: "98", bp: "118/76" },
        { note: "Regular sleep this week, no episodes", weight: "58kg" }
      ]
    },
    car: { registrationNo: "MH31AB1104", vehicleModel: "Honda City", color: "White", deviceA: "TSTA04", deviceB: "TSTB04" },
    demoEmergency: null
  },
  {
    mobile: "9822000105", name: "Vikram Rao", address: "Wardha, Maharashtra",
    patient: {
      name: "Lakshmi Rao", relation: "Mother", age: 70, gender: "Female", bloodGroup: "O-",
      diseases: ["Diabetes", "Heart valve replacement 2021"], allergies: ["Dust allergy"],
      defaultEmergency: "Heart attack / Chest pain",
      doctorMobile: "9822000001",
      contacts: [
        { name: "Vikram Rao", mobile: "9822000105", relation: "Son" },
        { name: "Anita Rao", mobile: "9822000196", relation: "Daughter-in-law" }
      ],
      tracker: [
        { note: "Sugar checked twice, both values inside range", sugar: "142" },
        { note: "Slight breathlessness after evening walk, rested 20 min", bp: "148/92", heartRate: "88", sugar: "176" },
        { note: "Cardiology review — valve function stable on echo", bp: "134/84", heartRate: "76" }
      ]
    },
    car: { registrationNo: "MH31AB1105", vehicleModel: "Mahindra Scorpio", color: "Black", deviceA: "TSTA05", deviceB: "TSTB05" },
    demoEmergency: {
      note: "Aspirin given, ECG reviewed; stable after reaching hospital"
    }
  },
  {
    mobile: "9822000106", name: "Ananya Joshi", address: "Chandrapur, Maharashtra",
    patient: {
      name: "Dev Joshi", relation: "Father", age: 49, gender: "Male", bloodGroup: "B-",
      diseases: ["Hypertension"], allergies: ["Dust"],
      defaultEmergency: "Severe bleeding / Accident",
      doctorMobile: "9822000005",
      contacts: [
        { name: "Radha Joshi", mobile: "9822000197", relation: "Wife" }
      ],
      tracker: [
        { note: "BP high after office stress, took medicine", bp: "152/94" },
        { note: "Evening walk 30 min, BP came down", bp: "136/86", heartRate: "82" },
        { note: "Monthly checkup with family physician", bp: "130/84", weight: "80kg" }
      ]
    },
    car: { registrationNo: "MH31AB1106", vehicleModel: "Maruti Baleno", color: "Red", deviceA: "TSTA06", deviceB: "TSTB06" },
    demoEmergency: null
  },
  {
    mobile: "9822000107", name: "Karan Mehta", address: "Yavatmal, Maharashtra",
    patient: {
      name: "Isha Mehta", relation: "Spouse", age: 32, gender: "Female", bloodGroup: "A-",
      diseases: ["Pregnancy week 28 (normal)"], allergies: ["None"],
      defaultEmergency: "Pregnancy complication",
      doctorMobile: "9822000004",
      contacts: [
        { name: "Karan Mehta", mobile: "9822000107", relation: "Husband" }
      ],
      tracker: [
        { note: "Kick movements normal, BP ok", bp: "112/70", weight: "62kg" },
        { note: "Mild swelling in feet, doctor advised salt control", bp: "118/74", weight: "63kg" },
        { note: "Anomaly scan clear — baby healthy", weight: "63kg", heartRate: "86" }
      ]
    },
    car: { registrationNo: "MH31AB1107", vehicleModel: "Kia Sonet", color: "Orange", deviceA: "TSTA07", deviceB: "TSTB07" },
    demoEmergency: {
      note: "Fetal heartbeat normal; observed 1 hr, advised rest at home"
    }
  },
  {
    mobile: "9822000108", name: "Divya Iyer", address: "Bhandara, Maharashtra",
    patient: {
      name: "Mohan Iyer", relation: "Father", age: 66, gender: "Male", bloodGroup: "O+",
      diseases: ["COPD"], allergies: ["Dust", "Smoke"],
      defaultEmergency: "Breathing difficulty",
      doctorMobile: "9822000003",
      contacts: [
        { name: "Shanti Iyer", mobile: "9822000198", relation: "Wife" },
        { name: "Divya Iyer", mobile: "9822000108", relation: "Daughter" }
      ],
      tracker: [
        { note: "Breathing ok at rest, used spacer with inhaler", heartRate: "80" },
        { note: "Cough increased at night, nebulized once", heartRate: "96", bp: "138/88" },
        { note: "Chest physician review — oxygen saturation fine", weight: "66kg", bp: "128/80" }
      ]
    },
    car: { registrationNo: "MH31AB1108", vehicleModel: "Toyota Innova", color: "Grey", deviceA: "TSTA08", deviceB: "TSTB08" },
    demoEmergency: null
  },
  {
    mobile: "9822000109", name: "Rohan Gupta", address: "Gondia, Maharashtra",
    patient: {
      name: "Aarav Gupta", relation: "Son", age: 8, gender: "Male", bloodGroup: "A+",
      diseases: ["Asthma (mild)"], allergies: ["Dust"],
      defaultEmergency: "Breathing difficulty",
      doctorMobile: "9822000004",
      contacts: [
        { name: "Neha Gupta", mobile: "9822000199", relation: "Mother" }
      ],
      tracker: [
        { note: "Played cricket 1 hr, no wheeze", heartRate: "92" },
        { note: "Dusty ground → mild cough, inhaler before sleep", heartRate: "98" },
        { note: "Pediatric review — growth on track", weight: "26kg" }
      ]
    },
    car: { registrationNo: "MH31AB1109", vehicleModel: "Hyundai i10", color: "White", deviceA: "TSTA09", deviceB: "TSTB09" },
    demoEmergency: {
      note: "Nebulization done, SpO2 98%; discharged in stable condition"
    }
  },
  {
    mobile: "9822000110", name: "Meera Kaur", address: "Gadchiroli, Maharashtra",
    patient: {
      name: "Gurpreet Singh", relation: "Father", age: 74, gender: "Male", bloodGroup: "B+",
      diseases: ["Arthritis", "Mild dementia"], allergies: ["Dust"],
      defaultEmergency: "High fever + unconscious",
      doctorMobile: "9822000002",
      contacts: [
        { name: "Meera Kaur", mobile: "9822000110", relation: "Daughter" }
      ],
      tracker: [
        { note: "Morning stiffness 30 min, knee pain while walking", weight: "70kg" },
        { note: "Forgot evening tablet, daughter reminded", bp: "144/88" },
        { note: "Neuro review — dementia stable, continue medication", bp: "136/84", weight: "69kg" }
      ]
    },
    car: { registrationNo: "MH31AB1110", vehicleModel: "Maruti Ertiga", color: "Silver", deviceA: "TSTA10", deviceB: "TSTB10" },
    demoEmergency: {
      note: "Responding to treatment, fever down; under observation in ward"
    }
  }
];

// user #3 (Amit Patil) raises the ONE open referral demo case
const REFERRAL_USER_MOBILE = "9822000103";
const REFERRAL_FROM_DOCTOR = DOCTORS[0]; // Dr. Aarav Sharma
const REFERRAL_TO_DOCTOR = DOCTORS[4]; // Dr. Kabir Nair
const REFERRAL_NOTE = "In OT, you handle";

/* ------------------------------------------------------------------ */
/* API wrappers                                                        */
/* ------------------------------------------------------------------ */

async function ensureIdentity({ mobile, name, role, address, doctorProfile }) {
  const reg = await withRetry(
    () => req("/auth/register", { method: "POST", body: { mobile, name, role, address, doctorProfile } }),
    `register ${mobile}`
  );
  if (reg.ok && reg.data?.token) {
    return { token: reg.data.token, user: reg.data.user, created: true };
  }
  if (reg.status === 409) {
    const login = await withRetry(
      () => req("/auth/login", { method: "POST", body: { mobile } }),
      `login ${mobile}`
    );
    if (login.ok && login.data?.token) {
      return { token: login.data.token, user: login.data.user, created: false };
    }
    throw new Error(`register said 409 but login failed: ${login.status} ${login.data?.error || ""}`);
  }
  throw new Error(`register failed: ${reg.status} ${reg.data?.error || ""}`);
}

async function listEmergencies(doctorToken) {
  const [allRes, activeRes] = await Promise.all([
    req("/emergencies", { token: doctorToken }),
    req("/emergencies/active", { token: doctorToken })
  ]);
  const merged = new Map();
  for (const e of [...(allRes.data || []), ...(activeRes.data || [])]) {
    if (e && e._id) merged.set(e._id, e);
  }
  return [...merged.values()];
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

const summary = {
  doctors: { created: 0, existing: 0 },
  users: { created: 0, existing: 0 },
  patients: { created: 0, existing: 0 },
  trackerEntries: { created: 0, alreadyPresent: 0 },
  cars: { created: 0, existing: 0 },
  resolvedEmergencies: [],
  referralEmergency: null,
  errors: []
};

function noteError(scope, err) {
  const msg = err?.message || String(err);
  summary.errors.push({ scope, error: msg });
  console.error(`  ✗ [${scope}] ${msg}`);
}

async function main() {
  console.log("=== MyAmbulance test-data seed ===");
  const health = await req("/health").catch(() => null);
  if (!health?.ok) {
    console.error("Backend not reachable at " + API + " — start the server first.");
    process.exit(1);
  }

  /* ---- 1. doctors ---- */
  const doctorTokens = {}; // mobile -> token
  const doctorIdsByMobile = {};
  console.log("\n[1/6] Doctors");
  for (const d of DOCTORS) {
    try {
      const { token, user, created } = await ensureIdentity({
        mobile: d.mobile,
        name: d.name,
        role: "doctor",
        address: d.address,
        doctorProfile: { degree: d.degree, specialization: d.specialization }
      });
      doctorTokens[d.mobile] = token;
      doctorIdsByMobile[d.mobile] = user.id;
      created ? summary.doctors.created++ : summary.doctors.existing++;
      console.log(`  ${created ? "+" : "="} Dr. ${d.name} (${d.mobile}, ${d.degree} ${d.specialization})`);
    } catch (e) {
      noteError(`doctor ${d.mobile} ${d.name}`, e);
    }
  }

  const doctorListRes = await req("/doctors", { token: doctorTokens[REFERRAL_FROM_DOCTOR.mobile] });
  for (const d of doctorListRes.data || []) {
    if (d.mobile && !doctorIdsByMobile[d.mobile]) doctorIdsByMobile[d.mobile] = d.id;
  }
  const referrerToken = doctorTokens[REFERRAL_FROM_DOCTOR.mobile];
  const refereeToken = doctorTokens[REFERRAL_TO_DOCTOR.mobile];
  if (!referrerToken || !refereeToken) {
    throw new Error("Referral demo needs Dr. Aarav Sharma and Dr. Kabir Nair tokens — doctor login failed");
  }
  const refereeId = doctorIdsByMobile[REFERRAL_TO_DOCTOR.mobile];
  if (!refereeId) throw new Error("Could not resolve Dr. Kabir Nair user id for referral");

  /* ---- 2. patient users + family patients + tracker + cars ---- */
  const records = []; // per-user working set for the emergency phase
  console.log("\n[2/6] Patient users, family patients, health tracker, cars");
  for (const u of USERS) {
    const scope = `user ${u.mobile} ${u.name}`;
    try {
      const { token, user, created } = await ensureIdentity({
        mobile: u.mobile,
        name: u.name,
        role: "patient",
        address: u.address
      });
      created ? summary.users.created++ : summary.users.existing++;
      console.log(`  ${created ? "+" : "="} user ${u.name} (${u.mobile}) — ${u.address}`);

      const rec = { user, token, data: u, patient: null, vehicle: null };

      // --- family patient ---
      let existingPatients = [];
      const listRes = await withRetry(() => req("/patients", { token }), `list patients ${u.mobile}`);
      existingPatients = Array.isArray(listRes.data) ? listRes.data : [];
      let patient = existingPatients.find((p) => String(p.name || "").trim().toLowerCase() === u.patient.name.trim().toLowerCase());

      if (patient) {
        summary.patients.existing++;
        console.log(`    = patient "${patient.name}" already exists`);
      } else {
        const doctor = DOCTORS.find((d) => d.mobile === u.patient.doctorMobile);
        const createdPatient = await withRetry(
          () =>
            req("/patients", {
              method: "POST",
              token,
              body: {
                name: u.patient.name,
                mobile: u.mobile,
                relation: u.patient.relation,
                age: u.patient.age,
                gender: u.patient.gender,
                bloodGroup: u.patient.bloodGroup,
                diseases: u.patient.diseases,
                allergies: u.patient.allergies,
                defaultEmergency: u.patient.defaultEmergency,
                personalDoctor: {
                  name: `Dr. ${doctor.name}`,
                  degree: doctor.degree,
                  specialization: doctor.specialization,
                  mobile: doctor.mobile
                },
                emergencyContacts: u.patient.contacts
              }
            }),
          `create patient ${u.patient.name}`
        );
        if (!createdPatient.ok) throw new Error(`create patient failed: ${createdPatient.status} ${createdPatient.data?.error || ""}`);
        patient = createdPatient.data;
        summary.patients.created++;
        console.log(`    + patient "${patient.name}" (${patient.relation}, ${patient.age}, ${patient.bloodGroup})`);
      }
      rec.patient = patient;

      // --- health tracker (3 entries, oldest first; API unshifts so newest ends up on top) ---
      const have = Array.isArray(patient.healthTracker) ? patient.healthTracker.length : 0;
      if (have >= 3) {
        summary.trackerEntries.alreadyPresent += 3;
        console.log(`    = tracker already has ${have} entries — skipping`);
      } else {
        const missing = u.patient.tracker.slice(have);
        for (const body of missing) {
          const r = await withRetry(
            () => req(`/patients/${patient._id}/tracker`, { method: "POST", token, body }),
            `tracker ${String(body.note || "").slice(0, 20)}`
          );
          if (!r.ok) throw new Error(`tracker add failed: ${r.status} ${r.data?.error || ""}`);
          summary.trackerEntries.created++;
          patient = r.data; // refresh
          rec.patient = patient;
        }
        console.log(`    + tracker: ${missing.length} entries added (${patient.healthTracker.length} total)`);
      }

      // --- car ---
      const listVehicles = await withRetry(() => req("/vehicles", { token }), `list vehicles ${u.mobile}`);
      const vehicles = Array.isArray(listVehicles.data) ? listVehicles.data : [];
      let vehicle = vehicles.find(
        (v) => String(v.registrationNo || "").trim().toUpperCase() === u.car.registrationNo.toUpperCase()
      );

      if (vehicle) {
        summary.cars.existing++;
        console.log(`    = car ${vehicle.registrationNo} already exists`);
      } else {
        const createdVehicle = await withRetry(
          () =>
            req("/vehicles", {
              method: "POST",
              token,
              body: {
                registrationNo: u.car.registrationNo,
                ownerName: u.name,
                vehicleModel: u.car.vehicleModel,
                color: u.car.color,
                devices: [
                  { deviceId: u.car.deviceA, label: "Siren + Red/Blue Lights" },
                  { deviceId: u.car.deviceB, label: "Beep Horn + Navigation" }
                ]
              }
            }),
          `create car ${u.car.registrationNo}`
        );
        if (!createdVehicle.ok) throw new Error(`create car failed: ${createdVehicle.status} ${createdVehicle.data?.error || ""}`);
        vehicle = createdVehicle.data;
        summary.cars.created++;
        // assign the family patient to the newly created car (never touches pre-existing cars)
        const assign = await req(`/vehicles/${vehicle._id}`, {
          method: "PUT",
          token,
          body: { assignedPatientId: patient._id }
        });
        if (assign.ok) vehicle = assign.data;
        console.log(`    + car ${vehicle.registrationNo} (${vehicle.vehicleModel}, ${vehicle.color}) devices ${u.car.deviceA}/${u.car.deviceB}`);
      }
      rec.vehicle = vehicle;
      records.push(rec);
    } catch (e) {
      noteError(scope, e);
    }
  }

  /* ---- 3. emergencies ---- */
  console.log("\n[3/6] Demo emergencies");
  let existingEmergencies = [];
  try {
    existingEmergencies = await listEmergencies(referrerToken);
  } catch (e) {
    noteError("list emergencies", e);
  }

  const findFor = (userId, patientId) =>
    existingEmergencies.filter((e) => String(e.userId) === String(userId) && (!e.patientId || String(e.patientId) === String(patientId)));

  // 3a. six resolved emergencies
  console.log("  -- resolved history emergencies --");
  for (const rec of records) {
    const u = rec.data;
    if (!u.demoEmergency || !rec.patient || !rec.vehicle) continue;
    const scope = `emergency ${u.mobile} ${u.patient.name}`;
    try {
      const mine = findFor(rec.user.id, rec.patient._id);
      let em = mine.find((e) => e.status === "resolved");

      if (em) {
        console.log(`    = resolved emergency ${em._id} already exists for ${u.patient.name}`);
      } else {
        let open = mine.find((e) => e.status === "active" || e.status === "acknowledged");
        if (!open) {
          const sos = await withRetry(
            () =>
              req("/emergencies/sos", {
                method: "POST",
                token: rec.token,
                body: {
                  patientId: rec.patient._id,
                  vehicleId: rec.vehicle._id,
                  emergencyType: u.patient.defaultEmergency,
                  location: nagpurLocation()
                }
              }),
            `sos ${u.mobile}`
          );
          if (!sos.ok) throw new Error(`SOS failed: ${sos.status} ${sos.data?.error || ""}`);
          open = sos.data;
          console.log(`    + SOS ${open._id} raised for ${u.patient.name} (${u.patient.defaultEmergency})`);
        } else {
          console.log(`    ~ reusing open SOS ${open._id} for ${u.patient.name}`);
        }

        const doctorMobile = u.patient.doctorMobile;
        const doctorToken = doctorTokens[doctorMobile] || referrerToken;
        const doctorName = `Dr. ${DOCTORS.find((d) => d.mobile === doctorMobile)?.name || "Aarav Sharma"}`;

        if (open.status !== "acknowledged") {
          const ack = await withRetry(
            () => req(`/emergencies/${open._id}/approve`, { method: "POST", token: doctorToken }),
            `approve ${open._id}`
          );
          if (!ack.ok) throw new Error(`approve failed: ${ack.status} ${ack.data?.error || ""}`);
        }
        const res = await withRetry(
          () =>
            req(`/emergencies/${open._id}/resolve`, {
              method: "POST",
              token: doctorToken,
              body: { doctorNote: u.demoEmergency.note }
            }),
          `resolve ${open._id}`
        );
        if (!res.ok) throw new Error(`resolve failed: ${res.status} ${res.data?.error || ""}`);
        em = res.data;
        console.log(`    ✓ emergency ${em._id} resolved by ${doctorName}`);
      }

      summary.resolvedEmergencies.push({
        emergencyId: em._id,
        user: `${u.name} (${u.mobile})`,
        patient: u.patient.name,
        car: u.car.registrationNo,
        type: em.emergencyType || u.patient.defaultEmergency,
        resolvedBy: `Dr. ${DOCTORS.find((d) => d.mobile === u.patient.doctorMobile)?.name || ""}`,
        doctorNote: u.demoEmergency.note
      });
    } catch (e) {
      noteError(scope, e);
    }
  }

  // 3b. the ONE open referred demo case (never approve / never resolve)
  console.log("  -- open referral demo case --");
  try {
    const rec = records.find((r) => r.data.mobile === REFERRAL_USER_MOBILE);
    if (!rec || !rec.patient || !rec.vehicle) {
      throw new Error(`referral user ${REFERRAL_USER_MOBILE} has no patient/car yet`);
    }
    const mine = findFor(rec.user.id, rec.patient._id);
    let em = mine.find((e) => e.status === "referred" && String(e.referral?.toDoctorId) === String(refereeId));

    if (em) {
      console.log(`    = referred emergency ${em._id} already open for Dr. ${REFERRAL_TO_DOCTOR.name}`);
    } else {
      let open = mine.find((e) => e.status === "active" || e.status === "acknowledged");
      if (!open) {
        const sos = await withRetry(
          () =>
            req("/emergencies/sos", {
              method: "POST",
              token: rec.token,
              body: {
                patientId: rec.patient._id,
                vehicleId: rec.vehicle._id,
                emergencyType: "General emergency",
                location: nagpurLocation()
              }
            }),
          "sos referral demo"
        );
        if (!sos.ok) throw new Error(`SOS failed: ${sos.status} ${sos.data?.error || ""}`);
        open = sos.data;
        console.log(`    + SOS ${open._id} raised for ${rec.patient.name} (General emergency)`);
      } else {
        console.log(`    ~ reusing open SOS ${open._id} for ${rec.patient.name}`);
      }
      const refer = await withRetry(
        () =>
          req(`/emergencies/${open._id}/refer`, {
            method: "POST",
            token: referrerToken,
            body: { toDoctorId: refereeId, note: REFERRAL_NOTE }
          }),
        `refer ${open._id}`
      );
      if (!refer.ok) throw new Error(`refer failed: ${refer.status} ${refer.data?.error || ""}`);
      em = refer.data;
      console.log(`    ✓ emergency ${em._id} referred: Dr. ${REFERRAL_FROM_DOCTOR.name} → Dr. ${REFERRAL_TO_DOCTOR.name} ("${REFERRAL_NOTE}")`);
    }

    summary.referralEmergency = {
      emergencyId: em._id,
      status: em.status,
      user: `${rec.user.name} (${rec.user.mobile})`,
      patient: rec.patient.name,
      car: rec.vehicle.registrationNo,
      type: "General emergency",
      referredFrom: `Dr. ${REFERRAL_FROM_DOCTOR.name} (${REFERRAL_FROM_DOCTOR.mobile})`,
      referredTo: `Dr. ${REFERRAL_TO_DOCTOR.name} (${REFERRAL_TO_DOCTOR.mobile})`,
      note: REFERRAL_NOTE,
      leftOpenOnPurpose: true
    };
  } catch (e) {
    noteError("referral demo", e);
  }

  /* ---- summary ---- */
  console.log("\n==================== SEED SUMMARY ====================");
  console.log(`doctors ensured      : ${summary.doctors.created + summary.doctors.existing}  (created ${summary.doctors.created}, already existed ${summary.doctors.existing})`);
  console.log(`patient users        : ${summary.users.created + summary.users.existing}  (created ${summary.users.created}, already existed ${summary.users.existing})`);
  console.log(`family patients      : ${summary.patients.created + summary.patients.existing}  (created ${summary.patients.created}, already existed ${summary.patients.existing})`);
  console.log(`health tracker       : ${summary.trackerEntries.created} new entries (${summary.trackerEntries.alreadyPresent} already present)`);
  console.log(`cars                 : ${summary.cars.created + summary.cars.existing}  (created ${summary.cars.created}, already existed ${summary.cars.existing})`);
  console.log(`resolved emergencies : ${summary.resolvedEmergencies.length}`);
  for (const e of summary.resolvedEmergencies) {
    console.log(`   - ${e.emergencyId}  ${e.patient}  (${e.car})  resolved by ${e.resolvedBy}`);
  }
  console.log(`open referral        : ${summary.referralEmergency ? 1 : 0}`);
  if (summary.referralEmergency) {
    const r = summary.referralEmergency;
    console.log(`   - ${r.emergencyId}  ${r.patient}  ${r.referredFrom} → ${r.referredTo}  note "${r.note}"  [left OPEN as "${r.status}" on purpose]`);
  }
  console.log(`errors                : ${summary.errors.length}`);
  for (const e of summary.errors) console.log(`   ! [${e.scope}] ${e.error}`);
  console.log("======================================================");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.errors.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error("Seed aborted:", e);
  process.exit(1);
});
