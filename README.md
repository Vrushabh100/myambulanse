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
`PORT`. Without `MONGODB_URI` the API falls back to an in-memory MongoDB.

`npm start` (in `server/`) runs `node index.js` with no `.env` file — used in
production, where env vars come from the platform. Use `npm run start:env` locally
if you want the plain start script with `.env` loaded.

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
2. Render dashboard → **New +** → **Web Service** → connect the repo.
3. Root directory: `server` (render.yaml already defines this).
4. Build command: `npm install && cd ../client && npm install && npm run build`
   (render.yaml sets this), start command: `npm start`.
5. Add env vars: `MONGODB_URI` (Atlas connection string) and `JWT_SECRET` (any long
   random string). Mark them secret/sync=false. `PORT` is injected by Render.
6. Create the service. The live URL serves the client UI, under `/api/*` for the API.
