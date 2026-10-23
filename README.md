# MyAmbulance

Ambulance dispatch app: React (Vite) client + Express/Mongoose API. In production the
server serves the built client from `client/dist`, so everything runs on one origin
(the client calls `/api` with relative paths).

## Run locally

Terminal 1 — server (loads `.env` from `server/`):

```powershell
cd server
npm install
npm run dev        # node --env-file=.env --watch index.js
```

Terminal 2 — client:

```powershell
cd client
npm install
npm run dev        # vite dev server with /api proxy
```

Copy `server/.env.example` to `server/.env` and fill in `MONGODB_URI`, `JWT_SECRET`,
`PORT`. `MONGODB_URI` is required (MongoDB Atlas connection string); if Atlas is
unreachable the API returns 503 and retries every 15s; data is never stored in memory.

`npm start` (in `server/`) runs `node index.js` with no `.env` file — used in
production, where env vars come from the platform. Use `npm run start:env` locally
if you want the plain start script with `.env` loaded.

## Deploy env vars

- `MONGODB_URI` - MongoDB Atlas connection string (required).
- `JWT_SECRET` - required in production; the server exits on startup if it is missing when `NODE_ENV=production`.
- `NODE_ENV=production` - enables the production safety gates (no dev JWT secret).
- `TRUST_PROXY=1` - set on Render (or behind any trusted reverse proxy) so `X-Forwarded-For` is honored for client IPs.
- `CORS_ORIGINS` - optional comma-separated list of extra browser origins allowed to call the API (same-origin deployments can leave this unset).

## Push to GitHub

```powershell
git init -b main
git add -A
git commit -m "MyAmbulance: client + server, ready for deploy"
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

## Deploy on Render

1. Push the repo to GitHub.
2. Render dashboard -> **New +** -> **Web Service** -> connect the repo.
3. Root directory: `server` (render.yaml already defines this).
4. Build command: `npm install && cd ../client && npm install && npm run build`
   (render.yaml sets this), start command: `npm start`.
5. Add env vars: `MONGODB_URI` (Atlas connection string) and `JWT_SECRET` (any long
   random string). Mark them secret/sync=false. `PORT` is injected by Render.
6. Create the service. The live URL serves the client UI, under `/api/*` for the API.

## Deploy (two Vercel projects)

Two projects are imported from the SAME repo. The client and API get different
domains, so the client calls the API by absolute URL and the API allows that origin.

Each Vercel project is configured entirely in the Vercel dashboard. In BOTH projects, leave the **Build Command** and **Output
Directory** fields **EMPTY**: the framework presets detect and run the correct build.
Setting either field makes Vercel run the command with its effective working
directory already set to the project's Root Directory, which fails with errors such
as `cd: client: No such file or directory`.

**Project A (site):**

1. Vercel -> **Add New... -> Project -> Import** the repo.
2. Root Directory: `client`  |  Framework Preset: **Vite**.
3. Build Command: *(leave EMPTY)*  |  Output Directory: *(leave EMPTY)*.
4. Environment Variable (Production + Preview): `VITE_API_BASE = https://<api-project>.vercel.app`.
   This value is baked in at build time, so **redeploy** after changing it.
5. Deploy.

**Project B (API):**

1. Import the SAME repo as a second project.
2. Root Directory: `server`  |  Framework Preset: **Express** (Vercel wraps the
   exported app from `server/index.js` as one serverless function).
3. Build Command: *(leave EMPTY)*  |  Output Directory: *(leave EMPTY)*.
4. Environment Variables (Production + Preview):
   - `MONGODB_URI` - MongoDB Atlas connection string (required).
   - `JWT_SECRET` - long random string (required in production).
   - `NODE_ENV=production` - production gates (no dev secret).
   - `TRUST_PROXY=1` - Vercel runs behind a proxy, so `X-Forwarded-For` is honored for client IPs.
   - `CORS_ORIGINS=https://<site-project>.vercel.app` - browser origin allowed to call the API.
5. Deploy.

MongoDB Atlas -> **Network Access** -> allow `0.0.0.0/0` (or Vercel egress IPs).

**Verify:**

1. `https://<api-project>.vercel.app/api/health` -> `{"ok":true,"db":"connected"}`.
2. Open the site URL and log in with `9822000101`.

The client calls the API through `VITE_API_BASE` (absolute) in this setup. When
`VITE_API_BASE` is unset the client falls back to relative `/api/...`, which is what
local dev and same-origin deploys use. MongoDB Atlas is required; if Atlas is
unreachable the API returns 503 and retries every 15s; data is never stored in memory.