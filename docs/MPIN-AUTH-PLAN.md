# MyAmbulance — MPIN Authentication: Implementation Plan

> Working engineering document (not a sales doc). Goal: replace mobile-only, IP-based auth with
> **6-digit MPIN** authentication, a **security-question** forgot-MPIN flow, a **default-MPIN
> recovery** path, and **device-token** auto-login. Another engineer/agent should be able to
> implement this without guessing. Engine: Express + Mongoose (`server/`), React + Vite (`client/`).

---

## 1. Objective & scope

### 1.1 What changes

| Area | Today | After |
|------|-------|-------|
| Login | `POST /auth/login { mobile }` — mobile only | `POST /auth/login { mobile, mpin }` — 6-digit MPIN, all roles incl. doctors |
| Registration | mobile + name (+ contacts/profile) | adds **MPIN (6)**, **security question** (dropdown of 10), **answer** |
| Forgot MPIN | none | `/login/mpin/forgotmpin` → answer question → `/login/mpin/setmpin` |
| Answer matching | n/a | case-insensitive + space-insensitive + punctuation-insensitive |
| Secret at rest | none | **personal MPIN** hashed (scrypt + per-user salt); **default MPIN** AES-256-GCM encrypted |
| Default MPIN | none | random 6-digit per user, never shown to user; owner reveals via admin panel |
| Recovery | none | login with **default MPIN** even when account blocked; forces question+answer change and lets user set a new personal MPIN |
| Lockout | none | 5 wrong → 60s break; 10 → 60s break; 15 → blocked + customer care |
| Auto-login | `POST /auth/auto` by **known IP** | `POST /auth/device/login` by **device token** (~30 days, hashed server-side, revocable) |
| Seeder | 15 accounts, mobile login | same 15 accounts get personal MPIN `123456` + generated default MPIN |
| Docs | Test-Accounts / Boss-Report say “no password” | updated to MPIN wording + MPIN per account |

### 1.2 What stays the same

- Endpoints `/auth/login`, `/auth/register`, `/auth/me` keep their paths (payloads extended).
- `User.mobile` stays the primary identity; `knownIps` field kept for backward compatibility but no longer drives auth.
- JWT session token still signed with `JWT_SECRET`, still 180 days for web sessions (see risks, §6).
- `publicUser()` contract stays (id, mobile, name, role, address, doctorProfile, emergencyContacts).
- SPA fallback, `/api` 503-when-DB-down middleware, CORS, DNS fix — unchanged.
- Emergency/patient/vehicle/doctor routes and their JWT middleware are unchanged apart from token scope checks.

### 1.3 Non-goals

- SMS/OTP, email, biometrics, WebAuthn, admin web UI (admin is an API + optional thin page).
- Migrating existing `knownIps` data (kept but unused).
- Multi-device limit beyond what `DeviceToken` naturally enforces.

---

## 2. Mindmap

```
MyAmbulance Auth
├── Registration  (/auth/register)
│   ├── identity: mobile, name, role(patient|doctor), address, doctorProfile, emergencyContacts
│   ├── personal MPIN (6 digits, strength-checked, scrypt hashed)
│   ├── security question (dropdown of 10 IPPB-style)  -> securityQuestion
│   ├── security answer  (normalized -> scrypt hashed) -> securityAnswerHash
│   └── server generates default MPIN -> AES-256-GCM -> defaultMpinEnc  (never shown to user)
│
├── Login  (/auth/login)
│   ├── verify personal MPIN  (scrypt + timingSafeEqual)
│   ├── success -> session JWT (scope=session) + DeviceToken issued
│   ├── fail    -> failedMpinAttempts++  -> 5/5/5 lock policy
│   └── wrong MPIN screen also shows "Forgot MPIN" link
│
├── Forgot / Reset  (/login/mpin/forgotmpin -> /login/mpin/setmpin)
│   ├── step 0: show security question for the mobile (+ customer care +91 8007470450)
│   ├── step 1: POST answer -> normalize -> compare -> reset JWT (scope=reset, 10 min)
│   ├── step 2: POST new personal MPIN with reset token -> hashed, counters cleared
│   └── 5/5/5 policy for wrong answers (15 -> answer input disappears, show customer care)
│
├── Default-MPIN recovery  (/login/mpin/setmpin in recovery mode)
│   ├── POST { mobile, defaultMpin } -> works EVEN IF account blocked
│   ├── success -> recovery JWT (scope=recovery, 15 min)
│   ├── screen shows EXCLUSIVE options:
│   │   ├── change security question + answer
│   │   └── set new personal MPIN
│   └── clear mpinBlocked / lockUntil on success
│
├── Device auto-login  (POST /auth/device/login)
│   ├── token issued only after a real MPIN login (or recovery login)
│   ├── stored hashed (sha256) in DeviceToken, expiresAt = +30d, revokedAt on logout
│   ├── valid  -> session JWT, lastUsedAt refreshed
│   └── revoked/expired/new device -> 401 -> login screen (MPIN required)
│
├── Admin panel  (GET /api/admin/user/:mobile)
│   ├── header x-admin-key == ADMIN_API_KEY (constant-time compare)
│   ├── returns decrypted default MPIN + masked profile
│   ├── rate limited (per IP + per key)
│   └── writes AdminAuditLog entry per lookup (never stores the revealed MPIN)
│
├── Security controls
│   ├── scrypt(password/MPIN, per-user salt) + timingSafeEqual
│   ├── answer normalization: lowercase -> strip non-alphanumerics -> collapse spaces
│   ├── AES-256-GCM default-MPIN encryption (DEFAULT_MPIN_ENC_KEY), fail-closed if missing
│   ├── token scopes: session(180d) | reset(10m) | recovery(15m)
│   ├── rate limits (per IP + per mobile, 10/min) on login/forgot/recovery/admin
│   └── generic errors to limit enumeration
│
├── Data model
│   ├── User: mpinHash, securityQuestion, securityAnswerHash, defaultMpinEnc, mpinSetAt,
│   │         securityQuestionUpdatedAt, failedMpinAttempts, failedAnswerAttempts,
│   │         lockUntil, mpinBlocked, answerBlocked, needsSecuritySetup
│   └── DeviceToken: userId, tokenHash(unique), deviceLabel, createdIp, lastUsedAt, expiresAt(TTL), revokedAt
│
├── Client routes (react-router)
│   ├── /auth/login            (mobile + MPIN)
│   ├── /auth/register         (mobile + MPIN + question + answer)
│   ├── /login/mpin/forgotmpin (question -> answer)
│   ├── /login/mpin/setmpin    (reset OR recovery: set new MPIN; recovery also edits Q&A)
│   └── boot: JWT(me) -> device token -> login screen
│
└── Docs + Seeder
    ├── docs/Test-Accounts.html / .pdf  : add MPIN column (123456) + note default MPIN is generated
    ├── docs/MyAmbulance-Boss-Report.html/.pdf : replace "no password" wording
    ├── seed-test-data.mjs : register with MPIN 123456 + Q/A; idempotent login fallback
    └── server/migrate-mpin.mjs : backfill the 15 legacy accounts (personal 123456 + generated default)
```

---

## 3. Data model

### 3.1 `User` — schema additions (`server/models/User.js`)

| Field | Type | Index | Default | Notes |
|-------|------|-------|---------|-------|
| `mpinHash` | String | none | — | `scrypt$<saltHex>$<hashHex>`; `select:false`; never reversible |
| `securityQuestion` | String | none | — | One of the 10 allowed questions (§6.9); shown by forgot-step-0 endpoint |
| `securityAnswerHash` | String | none | — | scrypt hash of the **normalized** answer; `select:false` |
| `defaultMpinEnc` | String | none | — | AES-256-GCM `ivHex:tagHex:cipherHex` of the 6-digit default MPIN; `select:false` |
| `mpinSetAt` | Date | none | — | last time personal MPIN was set/changed |
| `securityQuestionUpdatedAt` | Date | none | — | drives "please change your security details" banner for legacy users |
| `failedMpinAttempts` | Number | none | `0` | cumulative wrong-MPIN count (never auto-reset on success? → reset to 0 on success) |
| `failedAnswerAttempts` | Number | none | `0` | cumulative wrong-answer count; reset to 0 on successful reset |
| `lockUntil` | Date | none | `null` | login rejected while `now < lockUntil` |
| `mpinBlocked` | Boolean | none | `false` | true after 15 wrong MPINs → login disabled until recovery login |
| `answerBlocked` | Boolean | none | `false` | true after 15 wrong answers → answer input hidden |
| `needsSecuritySetup` | Boolean | none | `false` | true for legacy/backfilled users until they change Q&A |

Add to schema options: keep `{ timestamps: true }`. Mark secret paths `select: false` **and** explicitly
remove them in `publicUser()` (§3.3). Add a helper `userSchema.methods.verifyMpin(plain)` and
`.verifyAnswer(plain)` living in `server/utils/mpin.js` (imported) rather than schema methods, to keep
the model free of crypto.

### 3.2 New `DeviceToken` collection (`server/models/DeviceToken.js`)

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `userId` | ObjectId ref `User` | index | owner |
| `tokenHash` | String | **unique** | `sha256(rawToken)` hex; raw token only ever sent to client |
| `deviceLabel` | String | none | from `User-Agent`/client hint, best-effort |
| `createdIp` | String | none | `clientIp(req)` |
| `lastUsedAt` | Date | none | refreshed on each device login |
| `expiresAt` | Date | **TTL `expireAfterSeconds: 0`** | `createdAt + 30d`; Mongo auto-purges |
| `revokedAt` | Date | none | set on logout/revoke; `null` = active |
| `createdAt`/`updatedAt` | Date | — | timestamps |

A device is valid iff `revokedAt == null` and `expiresAt > now`. Logout revokes exactly the presented
token; a "revoke all devices" helper may be added (`deleteMany({ userId })`).

### 3.3 New `AdminAuditLog` collection (`server/models/AdminAuditLog.js`)

| Field | Type | Notes |
|-------|------|-------|
| `mobile` | String | identifier looked up (index) |
| `adminRef` | String | last 6 chars of the admin key hash, or `x-admin-id` header if provided |
| `ip` | String | caller IP |
| `at` | Date | timestamp (index) |
| `result` | String | `found` \| `not_found` \| `denied` |

Never store the revealed MPIN.

### 3.4 What must **never** appear in `publicUser`

`mpinHash`, `defaultMpinEnc`, `securityAnswerHash`, `securityQuestion`, `failedMpinAttempts`,
`failedAnswerAttempts`, `lockUntil`, `mpinBlocked`, `answerBlocked`. Only `securityQuestion` is exposed
via the dedicated `POST /auth/mpin/forgot/start` response. `publicUser()` stays exactly as today
(mongoose `select:false` plus allowlist object = double protection).
---

## 4. API contract

Base path `/api`. JSON in/out. Auth header `Authorization: Bearer <jwt>`. Mobile always trimmed,
must match `^[6-9]\d{9}$`. MPIN always exactly 6 ASCII digits (`^\d{6}$`) after trimming; client strips
non-digits but server re-validates.

### 4.1 Conventions

**Token scopes** (`scope` claim in the JWT):

| Scope | TTL | Issued by | May call |
|-------|-----|-----------|----------|
| `session` | 180d | register, login, recovery/login, device/login | everything a normal session uses |
| `reset` | 10m | forgot/verify (correct answer) | `POST /auth/mpin/set` only |
| `recovery` | 15m | recovery/login (correct default MPIN) | `recovery/set-mpin`, `recovery/update-question` only |

`authMiddleware` must reject `reset`/`recovery` tokens for ordinary routes (check `payload.scope === "session"`).
`/auth/me` likewise requires `session`.

**Shared validation errors** (apply to every endpoint taking these fields):

| Condition | HTTP | `error` |
|-----------|------|---------|
| mobile missing/invalid | 400 | `Enter a valid 10-digit Indian mobile number` |
| mpin missing/not 6 digits | 400 | `MPIN must be exactly 6 digits` |
| mpin weak (see §6.9) | 400 | `MPIN must be 6 digits and must not be 000000, 111111, 123456, 654321, or a repeated/sequential number` |
| body not JSON | 400 | `Invalid request body` |

**Lock messages** (single source of truth in `server/utils/mpin.js`):

| State | HTTP | `error` |
|-------|------|---------|
| wrong MPIN, under threshold | 401 | `Incorrect mobile number or MPIN.` *(plus `attemptsLeft`)* |
| 5th / 10th wrong | 429 | `Too many wrong attempts. Try again in 60 seconds. Need help? Call customer care +91 8007470450.` *(plus `lockSeconds:60`)* |
| 15th wrong (blocked) | 423 | `Account locked for your safety. Please call customer care +91 8007470450 for account recovery.` |
| wrong answer, under threshold | 401 | `Incorrect answer. Please try again.` *(plus `attemptsLeft`)* |
| 5th / 10th wrong answer | 429 | `Too many wrong attempts. Try again in 60 seconds. Need help? Call customer care +91 8007470450.` |
| 15th wrong answer | 423 | `Answer attempt limit reached. Please call customer care +91 8007470450 for account recovery.` |
| generic unrecognised mobile (login/forgot-verify/recovery) | 401 | `Incorrect mobile number or MPIN.` / `Incorrect answer. Please try again.` |

Constants: `CUSTOMER_CARE = "+91 8007470450"`.

### 4.2 Endpoint summary

| # | Method & path | Auth | Purpose |
|---|---------------|------|---------|
| 1 | `GET /api/auth/mpin/questions` | none | list the 10 allowed security questions |
| 2 | `POST /api/auth/register` | none | create account (MPIN + Q&A), auto-login |
| 3 | `POST /api/auth/login` | none | mobile + personal MPIN |
| 4 | `POST /api/auth/mpin/forgot/start` | none | fetch security question for a mobile |
| 5 | `POST /api/auth/mpin/forgot/verify` | none | verify answer → `reset` token |
| 6 | `POST /api/auth/mpin/set` | `reset` | set new personal MPIN |
| 7 | `POST /api/auth/mpin/recovery/login` | none | default MPIN → `recovery` token (bypasses block) |
| 8 | `POST /api/auth/mpin/recovery/set-mpin` | `recovery` | set new personal MPIN |
| 9 | `POST /api/auth/mpin/recovery/update-question` | `recovery` | change security question + answer |
| 10 | `POST /api/auth/device/login` | device token | auto-login from a known device |
| 11 | `POST /api/auth/device/revoke` | `session` | logout / revoke current device token |
| 12 | `GET /api/auth/me` | `session` | unchanged |
| 13 | `GET /api/admin/user/:mobile` | admin key | reveal decrypted default MPIN + masked profile |
| 14 | `POST /api/auth/auto` | none | **removed** → 410 (`MPINRequired`) |

### 4.3 Endpoint details

**1. `GET /api/auth/mpin/questions`**
- Success `200`: `{ "questions": ["What is your mother's maiden name?", "..."] }` (the 10 fixed strings, §6.9).

**2. `POST /api/auth/register`**
- Body: `{ mobile, name, role, address?, doctorProfile?, emergencyContacts?, mpin, securityQuestion, answer }`.
- Validation: existing rules (mobile/name/contacts) **plus** `mpin` (6 digits + strength), `securityQuestion` ∈ the 10 list, `answer` non-empty after trim.
- `201`/`200`: `{ token, user, deviceToken, requiresSecuritySetup:false }`.
- Errors: `400` (validation as §4.1), `409` `Mobile number already registered. Please login.`, `503` DB down.
- DB writes: creates `User` with `mpinHash`, `securityQuestion`, `securityAnswerHash`, generated `defaultMpinEnc`, `mpinSetAt`, `securityQuestionUpdatedAt = now`; creates a `DeviceToken`.

**3. `POST /api/auth/login`**
- Body: `{ mobile, mpin }`.
- Flow: load user (`.select('+mpinHash')`). If missing → dummy scrypt compare → `401` generic (no counter touch). If `mpinBlocked` → `423` customer-care. If `lockUntil > now` → `429` with `lockSeconds`. Verify `mpinHash`; on fail increment/decrement per §6.5; on success reset counters and issue tokens.
- `200`: `{ token, user, deviceToken }`.
- Errors: `400`, `401` generic, `429` (lock, with `lockSeconds`), `423` (blocked), `503`.
- DB writes (success): `failedMpinAttempts=0`, `lockUntil=null`, `mpinBlocked=false`, `lastLoginAt=now`, new `DeviceToken`; (fail): `failedMpinAttempts++` and, at multiples of 5, `lockUntil=now+60s` / `mpinBlocked=true`.

**4. `POST /api/auth/mpin/forgot/start`**
- Body: `{ mobile }`.
- `200`: `{ question: "<the user's securityQuestion>", customerCare: "+91 8007470450", blocked:false }`. If `answerBlocked` → `{ question:null, blocked:true, customerCare }` (screen shows customer care only).
- Errors: `400` mobile, `404` `Mobile number not registered. Please register first.`, `429` (per-IP rate limit), `503`.
- Note: this reveals existence; mitigated by login/verify being generic (see §6.6).

**5. `POST /api/auth/mpin/forgot/verify`**
- Body: `{ mobile, answer }`.
- Flow: normalize answer (§6.2), scrypt-compare against `securityAnswerHash`. Unknown mobile → generic `401` (dummy compare). On success clear `failedAnswerAttempts`, `answerBlocked=false`, issue `reset` token.
- `200`: `{ resetToken, expiresIn:600 }`.
- Errors: `400`, `401` `Incorrect answer. Please try again.` (+`attemptsLeft`), `429` (lock + customer care), `423` `Answer attempt limit reached...`, `503`.
- DB writes: `failedAnswerAttempts++` / `lockUntil` / `answerBlocked` as §6.5; on success reset counter.

**6. `POST /api/auth/mpin/set`**
- Auth: `reset` token (Bearer).
- Body: `{ newMpin }` (6 digits + strength).
- `200`: `{ ok:true, token, user, deviceToken }` (completes login in one step for UX).
- Errors: `400` invalid/weak MPIN, `401` `Reset link expired. Please start again.` (bad/expired scope), `503`.
- DB writes: `mpinHash = scrypt(newMpin)`, `mpinSetAt=now`, reset MPIN counters/`mpinBlocked=false`, `lockUntil=null`.

**7. `POST /api/auth/mpin/recovery/login`**
- Body: `{ mobile, defaultMpin }`.
- Flow: load user with `+defaultMpinEnc +mpinHash`. Must work when `mpinBlocked`/`lockUntil` set. Decrypt `defaultMpinEnc` (§6.3) and compare with **timingSafeEqual**. Verify the presented value equals the user's personal MPIN too? **No** — this endpoint should only accept the *default* MPIN; if the input equals the personal MPIN, treat as normal (or still allow) — decision: require the decrypted default MPIN, but also allow the personal MPIN (both are valid owner proofs) and still mark the session `recovery:true` only when the **default** MPIN matched.
- `200`: `{ recoveryToken, expiresIn:900, user, recovery:true }`.
- Errors: `400`, `401` `Incorrect mobile number or MPIN.`, `429` (rate limit), `503`.
- DB writes: clears `mpinBlocked=false`, `lockUntil=null`, `failedMpinAttempts=0`, new rate-limit bucket touch. No `DeviceToken` yet (issued later).

**8. `POST /api/auth/mpin/recovery/set-mpin`**
- Auth: `recovery` token.
- Body: `{ newMpin }` (6 digits + strength).
- `200`: `{ ok:true }`.
- Errors: `400`, `401` `Recovery session expired. Please login again.`, `503`.
- DB writes: `mpinHash` updated, `mpinSetAt=now`.

**9. `POST /api/auth/mpin/recovery/update-question`**
- Auth: `recovery` token.
- Body: `{ securityQuestion, answer }` (question ∈ the 10 list, answer non-empty).
- `200`: `{ ok:true, user }` — `user` includes new `securityQuestion`.
- Errors: `400`, `401`, `503`.
- DB writes: `securityQuestion`, `securityAnswerHash = scrypt(normalize(answer))`, `securityQuestionUpdatedAt=now`, `needsSecuritySetup=false`.

**10. `POST /api/auth/device/login`**
- Body: `{ deviceToken }` (raw token string).
- Flow: `sha256(deviceToken)` → lookup `DeviceToken`. Valid iff `revokedAt==null && expiresAt>now`. Then issue `session` and refresh `lastUsedAt` (optionally rotate the token — decision: **rotate** on each device login: delete used token, issue a new one, prevents replay of an old string).
- `200`: `{ token, user, deviceToken: <new>, auto:true }`.
- Errors: `400` missing token, `401` `Session expired. Please login with your MPIN.` (revoked/expired/unknown), `503`.

**11. `POST /api/auth/device/revoke`**
- Auth: `session`. Body: `{ deviceToken }` (the current one; optional — if omitted, revoke all of this user's tokens).
- `200`: `{ ok:true }`. DB writes: `revokedAt=now` (or `deleteMany({userId})`).

**13. `GET /api/admin/user/:mobile`**
- Auth: header `x-admin-key` **must** equal `ADMIN_API_KEY` (constant-time compare). If `ADMIN_API_KEY` unset → `503`/`500` fail-closed (endpoint disabled). Rate limit per IP + per key.
- `200`:
```json
{
  "mobile": "9822000101",
  "name": "R**** S******",
  "role": "patient",
  "defaultMpin": "480912",
  "mpinBlocked": true,
  "accountCreatedAt": "2026-01-02T10:00:00.000Z",
  "lastLoginAt": "2026-01-03T09:12:00.000Z"
}
```
- Masking: name → first char + `****` per word (keep first/last for support), mobile full (support needs it), never return `mpinHash`/`securityAnswerHash`.
- Errors: `401` `Unauthorized`, `404` `Mobile number not registered.`, `429` rate limited, `503` key missing / DB down.
- DB writes: one `AdminAuditLog` per call (`mobile`, `ip`, `adminRef`, `result`).

**14. `POST /api/auth/auto`** — returns `410 { "error": "MPINRequired", "message": "Auto-login by network is no longer supported. Please login with your MPIN." }`.
---

## 5. Client routes & screens

### 5.1 Route table (`client/src/App.jsx`)

| Path | Component / mode | When shown | Fields |
|------|------------------|-----------|--------|
| `/auth/register` | `AuthPage mode="register"` | first visit / “Register” | name, role, mobile, **MPIN (6)**, **security question (select)**, **answer**, (address / doctor fields / contacts as today) |
| `/auth/login` | `AuthPage mode="login"` | returning user | mobile, **MPIN (6)**; link “Forgot MPIN?” → `/login/mpin/forgotmpin` |
| `/login/mpin/forgotmpin` | `ForgotMpinPage` (new) | from login link | step 0: mobile → shows **question** + customer care; step 1: answer input |
| `/login/mpin/setmpin` | `SetMpinPage` (new) | after reset token **or** recovery session | new MPIN + confirm; **in recovery mode also**: `SecurityDetailsForm` (question + answer) |
| `/auth` | redirect | — | `authLanding()` unchanged |
| `*` (unauth) | redirect | — | `authLanding()` |

New files: `client/src/pages/ForgotMpinPage.jsx`, `client/src/pages/SetMpinPage.jsx`, and a shared
`client/src/components/MpinInput.jsx` (6 boxes / single `inputMode="numeric"` maxLength 6).
`api.js` gains `saveDeviceToken/getDeviceToken/clearDeviceToken` (key `ma_device_token`) replacing
`savedMobile` usage for boot; `ma_mobile` may still be kept for pre-filling the login form.

### 5.2 Screen states

**Login (`AuthPage` mode=login)**

| State | UI |
|-------|----|
| idle | mobile + 6-digit MPIN, `Login` button, `Forgot MPIN?` link |
| submitting | button disabled → “Please wait...” |
| wrong | inline error, MPIN cleared, focus MPIN |
| locked (429) | error + **60 → 0 countdown**; Login disabled until 0; customer-care line `+91 8007470450` shown as a `tel:` link |
| blocked (423) | MPIN field removed; panel “Account locked. Call customer care `+91 8007470450`.” + button “Login with default MPIN →” (`/login/mpin/setmpin?recovery=1`, which first asks mobile + default MPIN) |

**Register (`AuthPage` mode=register)**
- MPIN field (6, numeric), security-question `<select>` populated from `GET /auth/mpin/questions`,
  answer text input, plus hint: “Your answer is matched ignoring capital letters, spaces and
  punctuation — ‘Ujwal’, ‘UJWAL’, ‘u jwal’, ‘ujw al’ all match.” — **mandatory on-screen text**.

**ForgotMpinPage**

| Step | Fields | Notes |
|------|--------|-------|
| 0 | mobile | POST `forgot/start`; renders question text, hint about case/space-insensitivity, customer care link |
| 1 | answer | POST `forgot/verify` → store `resetToken` (memory/sessionStorage), `navigate('/login/mpin/setmpin')` |
| locked (429) | — | 60s countdown + customer care (same as login) |
| blocked (423) | — | answer input removed; “Call customer care `+91 8007470450`” panel |
| `blocked:true` from start | — | jump straight to the customer-care-only panel |

**SetMpinPage**
- Default mode: new MPIN + confirm → `POST /auth/mpin/set` with `resetToken` → set session and go `/`.
- Recovery mode (`?recovery=1`, state `{ recoveryToken }`): a two-card screen:
  1. **prominent** “Change security question & answer” card (question select + answer) → `recovery/update-question`.
  2. “Set a new MPIN” card → `recovery/set-mpin`.
  This card is rendered **only** for recovery sessions (a normal user does not know the default MPIN, so it is never shown otherwise). On success, offer “Login” → `/auth/login`.
- Weak-MPIN error text mirrored from API (§6.9).

### 5.3 Boot logic (`App.jsx` `useEffect`)

```
1. token = getToken()
   if token: GET /auth/me
       ok            -> setSession, render app
       isHttpError   -> clearSession(); continue
       network error -> keep storage, stop boot (let user retry)   [unchanged behavior]
2. else/after: dt = getDeviceToken()
   if dt: POST /auth/device/login { deviceToken: dt }
       ok            -> setSession(token,user); saveDeviceToken(new dt); render app
       isHttpError   -> clearDeviceToken(); continue
       network error -> stop boot (keep token for next load)
3. no valid session  -> login screen (authLanding())
```

`/auth/auto` is never called. `handleLogout` calls `POST /auth/device/revoke { deviceToken }`
(best-effort), then `clearSession()`, `clearDeviceToken()`, `clearSavedMobile()`.

### 5.4 1-minute lock countdown UI
- Reusable `<LockCountdown seconds={lockSeconds} />`: renders “…Try again in `mm:ss`”, ticks every
  second, disables the submit button, and shows the customer-care `tel:+918007470450` link. Used by
  login, forgot (answer) and any 429 response.

---

## 6. Security design

### 6.1 Password/MPIN hashing (`server/utils/mpin.js`)
- `hashSecret(plain, salt?)` → `scrypt$<saltHex>$<hashHex>`; `scryptSync` with `N=16384,r=8,p=1,keylen=64`, 16-byte random salt per user (per-user salt requirement satisfied).
- `verifySecret(plain, stored)` → parse, recompute, compare with **`crypto.timingSafeEqual`** (equal-length buffers guarded).
- Used for **both** `mpinHash` and `securityAnswerHash` (answer hashed after normalization).

### 6.2 Security-answer normalization
Order matters; implement exactly:
1. `String(answer)`; if null/undefined → `""`.
2. **Unicode normalize** `NFKC`.
3. `toLowerCase()` (locale-independent, plain `.toLowerCase()`).
4. Remove every character that is **not** `[a-z0-9]` (drops spaces, punctuation, emoji, dashes).
   - Equivalent regex: `str.replace(/[^a-z0-9]/g, "")`.
5. (Collapsing spaces is then unnecessary because spaces are removed, but if a non-Latin script is
   kept in a future revision, collapse `\s+` → single space in the same step.) Decision: **strip**
   whitespace entirely so “u jwal” → `ujwal` and “ujw al” → `ujwal`.
6. Hash the result with `hashSecret`.

Worked examples (all → hash input `ujwal`): `Ujwal`, `UJWAL`, `u jwal`, `ujw al`, `U.J.W.A.L`, `ujwal` ✅.

### 6.3 Default-MPIN encryption (AES-256-GCM)
- Key: `DEFAULT_MPIN_ENC_KEY`, 32 bytes, accepted as **base64 or hex** (auto-detect: 64 hex chars → hex,
  else base64). 
- Encrypt: `iv = randomBytes(12)`; `cipher = createCipheriv('aes-256-gcm', key, iv)`; store
  `ivHex + ":" + tagHex + ":" + cipherHex`.
- Decrypt: parse, `decipher.setAuthTag(tag)`, return UTF-8 plaintext.
- **Fail-closed:** if `DEFAULT_MPIN_ENC_KEY` is missing/invalid → registration and recovery/login
  return `503 { error: "Account recovery is unavailable. Contact customer care +91 8007470450." }`;
  never fall back to plaintext storage. Startup logs a fatal warning in production.
- Default MPIN generation: cryptographically random 6 digits via `crypto.randomInt(0, 1000000)` padded
  to 6 chars, retried until it passes the strength filter (§6.9). “Unique per user” = generated
  independently per user (collisions across users are acceptable; no global uniqueness index).

### 6.4 Admin API key
- `ADMIN_API_KEY` from env (long random string). Compare with constant-time:
  `timingSafeEqual(Buffer.from(provided), Buffer.from(expected))` guarded by length check; if unset →
  endpoint disabled (`503`). Rate limit 10/min per IP and 10/min per key. Every call (success, 404, and
  unauthorized attempts) writes `AdminAuditLog`. Optional `x-admin-id` header recorded in `adminRef`;
  otherwise store last 6 chars of `sha256(provided key)`.

### 6.5 Rate limiting & lockout
- **Lockout (per mobile, DB-backed):** `failedMpinAttempts` / `failedAnswerAttempts` cumulative.
  On each failure `n` (n = counter after increment): if `n >= 15` → set `mpinBlocked`/`answerBlocked`;
  else if `n % 5 === 0` → `lockUntil = now + 60s`. Login/verify reject while `lockUntil > now` (429 with
  `lockSeconds`) or blocked (423). Counters reset to 0 on successful login/verify.
- **HTTP rate limit (per IP and per mobile):** 10 req/min on `/auth/login`, `/auth/mpin/forgot/*`,
  `/auth/mpin/recovery/login`, and `/api/admin/*` (in-memory token bucket keyed by `clientIp(req)` and
  by normalized mobile; `429` on exceed). In-memory limiter is acceptable per instance; note serverless
  caveat in §6.10.

### 6.6 Enumeration reduction — exact message changes

| Endpoint | Before | After |
|----------|--------|-------|
| `/auth/login` unknown mobile | `404 Mobile number not registered. Please register first.` | `401 Incorrect mobile number or MPIN.` |
| `/auth/login` wrong MPIN | (n/a) | `401 Incorrect mobile number or MPIN.` |
| `/auth/mpin/forgot/verify` unknown mobile | (n/a) | `401 Incorrect answer. Please try again.` (same as wrong answer) |
| `/auth/mpin/recovery/login` unknown mobile | (n/a) | `401 Incorrect mobile number or MPIN.` |
| `/auth/mpin/forgot/start` unknown mobile | (n/a) | `404 Mobile number not registered. Please register first.` **(kept; unavoidable to show a question)** |
| `/auth/register` duplicate | `409 Mobile number already registered. Please login.` | unchanged (registration inherently reveals existence) |

All generic responses must take ~the same time (always run a dummy `scrypt` compare when no user/hash
exists) to avoid timing enumeration.

### 6.7 Token scopes
See §4.1. `reset` and `recovery` tokens carry `scope` and the user id; `authMiddleware` and `/auth/me`
require `scope === "session"`. `reset`/`recovery` routes verify their own scope and are rejected if the
scope is wrong (`401`). Recovery tokens may **not** call anything except the two recovery endpoints.

### 6.8 Device-token hashing / expiry / revocation
- Issue: `raw = randomBytes(32).toString('base64url')`; store `sha256(raw)`; return `raw` once.
- Expiry: `expiresAt = now + 30d`; Mongo TTL index purges automatically.
- Revocation: `revokedAt = now` on logout; rotate on each device login (delete old row, create new).
- Never log the raw token.

### 6.9 MPIN strength rules
- Must be exactly 6 digits.
- Reject: `000000`, `111111`, `123456`, `654321`, all-same-digit (`000000`,`111111`,…`999999`),
  ascending/descending consecutive runs of length 6 (`123456`,`234567`,`…`,`987654`,`654321`, etc.),
  and any 6-digit sequence equal to a simple repeated 3-pattern (`121212`, `123123`, `112233`? →
  decision: reject `ababab` and `abcabc` patterns explicitly).
- User-facing message (exact): `MPIN must be 6 digits and must not be 000000, 111111, 123456, 654321, or a repeated/sequential number`.
- Default MPIN generation also passes this filter.

### 6.10 Threat notes
- Rate limiting is per-instance in memory; on Vercel multi-instance, add a shared store (Mongo/Redis)
  if abuse is observed — flagged as follow-up.
- Remaining risks: `localStorage` XSS (session + device token readable by script) → mitigations: strict
  CSP, no `dangerouslySetInnerHTML`, short device-token rotation, revoke-on-logout; **JWT 180d** is long
  → acceptable for an emergency app but recommend shortening session and leaning on device tokens;
  admin key brute force → constant-time compare + strict rate limit + audit log.
- `defaultMpinEnc` is reversible by design; protect `DEFAULT_MPIN_ENC_KEY` as a top-tier secret and
  restrict admin key distribution.

---

## 7. Legacy migration

### 7.1 `server/migrate-mpin.mjs`

Run from `server/`:

```bash
node --env-file=.env migrate-mpin.mjs
```

Behaviour, in order:

1. **Env guard.** Require `MONGODB_URI` and `DEFAULT_MPIN_ENC_KEY`. If either is missing or empty,
   print a clear error to stderr and `process.exit(1)` before doing any work.
2. **DNS.** Force the resolver to `8.8.8.8` / `1.1.1.1`, matching `server/index.js`, so Atlas SRV
   lookups behave the same in the migration process as in the app.
3. **Connect.** `await mongoose.connect(process.env.MONGODB_URI)`; exit non-zero on failure.
4. **Iterate.** Find every user that is **missing `mpinHash`** (`{ mpinHash: { $exists: false } }`,
   plus `mpinHash: null`). Users that already have a hash are never touched.
5. **Backfill** (see 7.2 / 7.3), then write with `updateOne` scoped to `{ _id, mpinHash: { $in: [null, undefined] } }`
   so a concurrent write cannot be clobbered.
6. **Report.** Print total scanned, total migrated, and the list of the 15 known demo mobiles only.
   Never print any generated default MPIN, hash, or encryption key.
7. **Idempotency.** Re-running the script is a no-op: every already-migrated user has an `mpinHash`
   and is skipped. The counts on a second run show `migrated: 0`.

### 7.2 Known demo accounts (15)

Mobiles `9822000001`-`9822000005` (doctors) and `9822000101`-`9822000110` (patients).

- Personal MPIN: `123456`. This is allowed even though it would fail the user-facing strength check
  because the migration writes the hash directly and **login never enforces strength** — strength is
  enforced only on the set/register path.
- `securityQuestion`: `What is your best friend's name?`
- `securityAnswerHash`: scrypt hash of `myambulance`.
- `defaultMpinEnc`: a generated encrypted default MPIN (AES-256-GCM with `DEFAULT_MPIN_ENC_KEY`).
- `mpinSetAt` = `securityQuestionUpdatedAt` = now.
- `mpinBlocked` = `false`, `needsSecuritySetup` = `false`.

### 7.3 Other legacy users

Every other legacy user lacking an MPIN:

- Random, strong personal MPIN generated server-side and **not disclosed** — the user cannot guess it.
- `mpinHash` = scrypt hash of that random MPIN.
- `mpinBlocked` = `true` (personal login is closed until they recover).
- `defaultMpinEnc` = a generated encrypted default MPIN (shared owner default).
- Placeholder `securityQuestion` ("Set your security question") and a non-matching placeholder answer hash.
- `needsSecuritySetup` = `true`.
- Recovery path: owner default MPIN login (`recovery: true`) followed by customer care, then
  `recovery/update-question` + `recovery/set-mpin` to establish their own credentials.
### 7.4 Seeder (`server/seed-test-data.mjs`)

The seeder must send MPIN credentials on both register and login, because the API now requires them:

- Register/login payload includes `mpin: "246813"` — a strong value accepted by the strength filter —
  plus `securityQuestion` and `answer`.
- The login fallback sends `{ mobile, mpin }`.
- Note the split: the **15 pre-existing demo accounts log in with `123456`** (their migrated value),
  while **freshly seeded accounts use `246813`**.

### 7.5 Docs

`docs/Test-Accounts.html` gains an **MPIN** column so testers see `123456` for migrated accounts and
`246813` for seeded accounts without digging into this plan.

---

## 8. Dry run (request → response → DB writes)

| # | Request | Response | DB writes |
|---|---------|----------|-----------|
| 1 | `POST /auth/register` with MPIN + question + answer | `201` `{ token, user, deviceToken }` | User created with `mpinHash`, `securityQuestion`, `securityAnswerHash`, `defaultMpinEnc`, `mpinSetAt`, `securityQuestionUpdatedAt`; new `DeviceToken` row |
| 2 | `POST /auth/login` correct personal MPIN | `200` | `mpinFails=0`, `mpinLockUntil=null`, `lastLoginAt=now`; `DeviceToken` created/rotated |
| 3 | 5 wrong MPINs | 1st-4th `401`; **5th `429` locked 60s** | `mpinFails` increments 1→5, `mpinLockUntil=now+60s` |
| 4 | 10 wrong MPINs (after window) | another `429` lock | `mpinFails` climbs again, `mpinLockUntil` refreshed |
| 5 | 15 wrong MPINs total | **`423` blocked**, customer care | `mpinBlocked=true`, `mpinFails=15` |
| 6 | `POST /auth/forgot` (start) | `200` question + customer-care hint | none (read-only) |
| 7 | `POST /auth/forgot/verify` correct answer | `200` `{ resetToken }` (10 min) | `resetTokenHash`, `resetTokenExpiresAt=now+10m` |
| 8 | `POST /auth/forgot/set-mpin` with reset token | `200`, new session | new `mpinHash`, `mpinSetAt=now`, `mpinFails=0`, `mpinBlocked=false`; old reset token rejected on reuse (one-time, validated via `mpinSetAt` vs token `iat`) |
| 9 | 15 wrong security answers | `423`, `answerBlocked=true`, answer input hidden, customer care | `answerFails=15`, `answerBlocked=true` |
| 10 | `POST /auth/login` with **default** MPIN | `200` `{ recovery: true }` + 15-minute recovery session | `lastLoginAt=now`; session marked `recovery=true` for 15 min |
| 11 | `POST /auth/recovery/update-question` | `200` | `securityQuestion`, `securityAnswerHash`, `securityQuestionUpdatedAt=now` |
| 12 | `POST /auth/recovery/set-mpin` | `200` non-recovery session | new `mpinHash`, `mpinSetAt=now`, `needsSecuritySetup=false`, `mpinBlocked=false` |
| 13 | Login with the new personal MPIN | `200` | normal counters/lastLogin writes |
| 14 | `POST /auth/device-login` after a prior MPIN login | `200` `{ auto: true }` | `DeviceToken` rotated (old token invalidated) |
| 15 | Device token revoked/expired | `401` → login screen | token row deleted/expired |
| 16 | Reuse a reset token on `/auth/me` or `/patients` | `401` scope error | none — reset tokens are not session tokens |
| 17 | Admin lookup with no key / with key | `401` / `200` | audit row appended on success and on failed-key attempts |
| 18 | Wrong-MPIN attempt on a blocked account | `423` | no counter change (already blocked) |

Additional notes:

- A wrong **default** MPIN on a blocked account is governed by a **strict 5-per-15-minute limiter**,
  separate from the personal-MPIN lockout ladder.
- Account enumeration is mitigated by a **dummy scrypt** compare on unknown mobiles so login/verify
  latency is constant whether or not the account exists.

---

## 9. Test matrix

### 9.1 Functional

| Area | Cases |
|------|-------|
| Register | valid MPIN+question+answer → 201; missing/weak MPIN → 400; duplicate mobile → 409 |
| Login | correct personal MPIN → 200; wrong → 401 + counter; correct default → 200 `recovery:true` |
| Lockout | 5→429, 10→429, 15→423; lock expiry restores attempts |
| Forgot/reset | start returns question; correct answer → resetToken; set-mpin → new session; token reuse → 401 |
| Recovery | 15-min recovery window; update-question → set-mpin → normal login works |
| Device token | device-login `{auto:true}`; rotation invalidates prior token; revoke → 401 |
| Admin lookup | valid key → 200 + audit; missing/wrong key → 401 |
| Seeder | seeds with `246813`; migrated demo accounts keep `123456` |

### 9.2 Security

| Vector | Expectation |
|--------|-------------|
| Brute force 5/10/15 | escalating 429/423 with counters persisted |
| Default-MPIN brute force | strict 5-per-15-min limiter, independent |
| Enumeration | generic failure messages on login/verify; dummy scrypt timing |
| Token-scope abuse | reset/recovery tokens rejected on general endpoints (401) |
| Device-token replay/rotation | rotated token rejected; only newest valid |
| Timing | constant-time compare for MPIN, admin key, reset token |
| Admin-key brute force | constant-time compare + strict rate limit + audit log |
| At rest | `mpinHash` scrypt, `defaultMpinEnc` AES-256-GCM, `securityAnswerHash` scrypt |
| Public surface | no hash/enc/key fields in `publicUser` |
| Injection | NoSQL operator injection and prototype pollution rejected; inputs type-checked |
| Headers | XSS/CSP, CSRF token on mutating routes, clickjacking (`X-Frame-Options`/`frame-ancestors`) |
| Rate limits | per-IP and per-mobile limits on login/forgot/admin |

### 9.3 Bug / edge

| Case | Expectation |
|------|-------------|
| Leading-zero MPIN (`012345`) | kept as string, never coerced to a number |
| Non-numeric MPIN | rejected with 400 |
| Weak MPIN | rejected on set/register only (not on login) |
| Answer with emoji/punctuation | normalized consistently before hashing |
| Answer in Devanagari | preserved (encoding-safe normalize) |
| Mobile with spaces | trimmed/normalized before lookup |
| Concurrent attempts | counters not lost under parallel requests |
| DB down | 503, no crash |
| Cold start | device tokens still validate after restart |
---

## 10. Rollout & rollback

### 10.1 Required environment

| Var | Notes |
|-----|-------|
| `DEFAULT_MPIN_ENC_KEY` | 32-byte key, base64 or hex; encrypts/decrypts the default MPIN |
| `ADMIN_API_KEY` | admin lookup bearer |
| `JWT_SECRET` | session signing |
| `MONGODB_URI` | Atlas SRV |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` (correct client IP behind the proxy) |
| `CSP_CONNECT_SRC` | optional, CSP connect-src override |
| `MPIN_LOCK_SECONDS` | optional, default `60` |

### 10.2 Deploy order

1. **Back up the database.**
2. **Deploy the code.**
3. **Run the migration** (`node --env-file=.env migrate-mpin.mjs` from `server/`).
4. **Verify the 15 demo logins** (doctors `9822000001-05`, patients `9822000101-10`) with `123456`.
5. **Update docs** (`docs/Test-Accounts.html`).

### 10.3 Rollback

Redeploy the **previous commit**. There is deliberately **no runtime bypass flag**: a bypass that
accepts mobile-only login would undo the entire security fix, so an explicit `MPIN_ENFORCED=0` is
**intentionally NOT provided**.

### 10.4 Reconciled decision

The default MPIN is accepted by the **same** `POST /auth/login` (which returns `recovery: true` plus a
15-minute recovery session). There is **no separate recovery-login endpoint**; only
`recovery/set-mpin` and `recovery/update-question` are separate.